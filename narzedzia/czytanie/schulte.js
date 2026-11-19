/* Trener czytania — tablica Schultego.
   Dwa tryby: jedna plansza (czas i rekord) albo seria: plansze startują same, a poziom dobiera się według tempa
   (sekundy na pole względem progu danego rozmiaru). */
'use strict';

(() => {
  const { $, el } = T;
  const modul = $('m-schulte');
  const plansza = $('s-plansza');
  const ramka = $('s-ramka');
  const nakladka = $('s-nakladka');

  // Próg domyślny w sekundach na pole. Rośnie z rozmiarem (więcej pól = dłuższe szukanie każdego), dobrany
  // do pierwszych wyników z telefonu (19.11.2026: 3×3 ok. 0,48, 4×4 ok. 0,65, 5×5 ok. 0,9–1,0 s/pole).
  const PROG = { 3: 0.50, 4: 0.65, 5: 0.80, 6: 0.95, 7: 1.10, 8: 1.25, 9: 1.40, 10: 1.55 };
  // Próg osobisty: po 5 planszach na danym rozmiarze = mediana ostatnich 10 temp minus 5%,
  // ale nie łatwiej niż 130% i nie trudniej niż 70% progu domyślnego
  const WLASNY_PO = 5, WLASNY_ZAPAS = 0.95, WLASNY_MIN = 0.7, WLASNY_MAX = 1.3;
  const ZA_WOLNO = 1.6;          // tempo wolniejsze niż 1,6 × próg = plansza „za trudna”
  const MAX_BLEDOW_AWANS = 1;
  const BLEDY_SPADEK = 4;
  const POD_RZAD = 2;            // ile plansz z rzędu daje awans albo spadek
  const PAUZA_S = 3;
  // Podpowiedź na chwilę „ślepoty”: gdy jeden znak szukasz ok. 3,5 raza dłużej niż próg na pole (najmniej 2,5 s),
  // podświetla się ćwiartka tablicy; przy „prowadzeniu” po kolejnych 2 × próg (najmniej 1,5 s) samo pole.
  // Pomoc ma przyjść przy prawdziwym zacięciu, nie przy zwykłym szukaniu — za wczesna uczy czekania na nią.
  const PODP_RAZY = 3.5, PODP_MIN_S = 2.5, POLE_RAZY = 2, POLE_MIN_S = 1.5;
  const MAX_PODP_AWANS = 1;      // awans tylko przy najwyżej jednej podpowiedzi na planszę
  const MIN_N = 3;

  const g = { n: 5, znaki: 'liczby', kolejka: [], i: 0, bledy: 0, trwa: false, start: 0, zegar: null,
    podp: 0, etap: 0, ostatnie: 0, poMs: 0, poleMs: 0, prog: 0, stanTempa: '', rytmiczna: false, wRytmie: 0 };
  const s = { aktywna: false, n: 5, sufit: 7, limitPlansz: 10, limitMs: 0, start: 0, plansze: [], dobre: 0, slabe: 0, odliczanie: null, czeka: false, ostatnia: null };

  const ustawienia = () => T.stan.schulte.seria;
  const trybSerii = () => $('s-tryb').value === 'seria';
  const klucz = () => `${g.n}_${g.znaki}`;
  const rozmiar = (n) => `${n}×${n}`;
  const sPole = (t) => `${T.ulamek(t, 2)} s/pole`;
  const minSek = (ms) => { const c = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };

  function progDla(n, znaki = g.znaki) {
    const t = ustawienia().tempa[`${n}_${znaki}`] || [];
    if (t.length < WLASNY_PO) return { prog: PROG[n], wlasny: false };
    const p = [...t].sort((a, b) => a - b);
    const mediana = p.length % 2 ? p[(p.length - 1) / 2] : (p[p.length / 2 - 1] + p[p.length / 2]) / 2;
    const prog = Math.min(PROG[n] * WLASNY_MAX, Math.max(PROG[n] * WLASNY_MIN, mediana * WLASNY_ZAPAS));
    return { prog: Math.round(prog * 1000) / 1000, wlasny: true };
  }
  const opisProgu = (o) => `${T.ulamek(o.prog, 2)}${o.wlasny ? ' (Twój)' : ''}`;
  function zapamietajTempo(n, znaki, tempo) {
    const k = `${n}_${znaki}`;
    const t = ustawienia().tempa[k] || [];
    t.push(Math.round(tempo * 1000) / 1000);
    ustawienia().tempa[k] = t.slice(-T.MAX_TEMP);
  }
  // Lista progów pod ustawieniami Flow (do wglądu i strojenia)
  function pokazProgi() {
    const u = ustawienia();
    const czesci = [];
    for (let n = MIN_N; n <= u.sufit; n++) czesci.push(`${rozmiar(n)} ${opisProgu(progDla(n))}`);
    $('s-progi').textContent = `Progi (s/pole, ${g.znaki}): ${czesci.join(' · ')}.`;
  }

  // ---------- podpowiedzi ----------
  function zgasPodpowiedz() {
    plansza.querySelectorAll('.obszar, .podpowiedz').forEach((b) => b.classList.remove('obszar', 'podpowiedz'));
    g.etap = 0;
    g.ostatnie = performance.now();
  }
  // Ćwiartka z polem szukanego znaku: ceil(n/2) wierszy i kolumn (przy nieparzystym n środkowy pas należy do obu)
  function pokazCwiartke(pola, idx) {
    const n = g.n, h = Math.ceil(n / 2);
    const r = Math.floor(idx / n), c = idx % n;
    const r0 = r < n / 2 ? 0 : n - h, c0 = c < n / 2 ? 0 : n - h;
    pola.forEach((b, i) => {
      const ri = Math.floor(i / n), ci = i % n;
      if (ri >= r0 && ri < r0 + h && ci >= c0 && ci < c0 + h && !b.classList.contains('trafione')) b.classList.add('obszar');
    });
  }
  function sprawdzPodpowiedz() {
    const rodzaj = ustawienia().podpowiedzi;
    if (rodzaj === 'brak' || !g.trwa || g.etap >= (rodzaj === 'pole' ? 2 : 1)) return;
    if (performance.now() - g.ostatnie < (g.etap === 0 ? g.poMs : g.poleMs)) return;
    const pola = [...plansza.querySelectorAll('.pole-planszy')];
    const idx = pola.findIndex((b) => b.dataset.v === g.kolejka[g.i]);
    if (idx < 0) return;
    if (g.etap === 0) { pokazCwiartke(pola, idx); g.podp++; } else pola[idx].classList.add('podpowiedz');
    g.etap++;
  }

  // ---------- tempo: pasek albo kolor tablicy ----------
  // Pasek: kreska idzie w tempie progu (na końcu = cała plansza w czasie próg × liczba pól), wypełnienie to znalezione
  // znaki; przed kreską = tempo na awans. Kolor tablicy: niebieskawa = wyprzedzasz próg, zwykła = w tempie,
  // bursztynowa = wolniej — widać kątem oka, bez odrywania wzroku od środka (pasek trzeba było „odczytać”).
  // Niebieski i bursztyn różnią się też jasnością: rozróżnialne przy protanopii, deuteranopii, tritanopii
  // i w samej szarości (symulacja Machado 2009, ΔE ≥ 9 między każdą parą stanów).
  const TEMPO_START_POL = 2;     // przez pierwsze ~2 pola tablica zostaje zwykła (za mało danych)
  const TEMPO_MARGINES = 0.1;    // „w tempie” = ±10% oczekiwanej liczby znaków (najmniej 1 znak)
  function stanTempa() {
    const oczekiwane = (performance.now() - g.start) / 1000 / g.prog;
    if (oczekiwane < TEMPO_START_POL) return '';
    const przewaga = g.i - oczekiwane;
    const m = Math.max(1, TEMPO_MARGINES * oczekiwane);
    // histereza: wejście w stan po przekroczeniu marginesu, wyjście dopiero po powrocie do połowy — bez mrugania
    if (g.stanTempa === 'przed' && przewaga > m / 2) return 'przed';
    if (g.stanTempa === 'wolniej' && przewaga < -m / 2) return 'wolniej';
    if (przewaga > m) return 'przed';
    if (przewaga < -m) return 'wolniej';
    return '';
  }
  function ustawKolorTempa(stan) {
    g.stanTempa = stan;
    ramka.classList.toggle('tempo-przed', stan === 'przed');
    ramka.classList.toggle('tempo-wolniej', stan === 'wolniej');
  }
  function pokazTempo() {
    const tryb = ustawienia().tempo;
    if (!g.trwa) {
      if (g.i > 0) return;   // po planszy zostaje ostatni stan
      ustawKolorTempa('');
    }
    if (tryb === 'kolor') { if (g.trwa) ustawKolorTempa(stanTempa()); return; }
    if (tryb !== 'pasek') return;
    const pasek = $('s-tempo');
    const ile = g.kolejka.length || 1;
    const kreska = g.trwa ? Math.min(1, (performance.now() - g.start) / 1000 / (g.prog * ile)) : 0;
    const zrobione = g.i / ile;
    pasek.firstElementChild.style.width = `${(zrobione * 100).toFixed(1)}%`;
    pasek.lastElementChild.style.left = `calc(${(kreska * 100).toFixed(1)}% - 1px)`;
    pasek.classList.toggle('za', g.trwa && zrobione < kreska);
  }
  // Widoczność pasków, palety i próbki kolorów według ustawienia
  function zastosujTempo() {
    const u = ustawienia();
    $('s-tempo').hidden = u.tempo !== 'pasek';
    $('s-paleta-pole').hidden = u.tempo !== 'kolor';
    $('s-probka').hidden = u.tempo !== 'kolor';
    modul.classList.toggle('paleta-wyrazna', u.paleta === 'wyrazna');
    if (u.tempo !== 'kolor') ustawKolorTempa('');
  }

  // ---------- metronom ----------
  // Dźwięk generuje przeglądarka (Web Audio) — bez plików i obcych serwerów. Stuknięcia planowane z wyprzedzeniem
  // na zegarze dźwięku, więc rytm jest równy, nawet gdy strona ma chwilowo dużo pracy.
  // „Rytm progu”: jedno stuknięcie na pole w tempie progu; wyższy, jaśniejszy dźwięk, gdy znalezione znaki wyprzedzają rytm.
  // „Spokojny rytm”: główne uderzenie (na start co 1,5 s) i dwa cichsze podziały między nimi. Trafienie znaku
  // w główne uderzenie dostaje premię (cichy dzwonek, niebieska poświata ramki) — uczy czekać na rytm zamiast gonić,
  // a podziały pomagają do niego wrócić. Kliknięcie między uderzeniami nie jest błędem, tylko nie ma premii.
  // Progresja: dwie plansze z rzędu z ≥ 80% trafień w rytm › rytm szybszy o 5% (zmianę tempa o kilka procent
  // ledwo się wyczuwa — „odrobinę”); dwie z rzędu < 50% › krok wolniej. W tym rytmie Flow nie zmienia rozmiaru
  // za tempo (plansza jest celowo wolna), a jej tempo nie wchodzi do progu osobistego.
  const SPOKOJNY_AKCENT = 3;
  const RYTM_START = 1.5, RYTM_MIN = 0.6, RYTM_MAX = 2.5, RYTM_KROK = 0.95, RYTM_DOBRZE = 0.8, RYTM_SLABO = 0.5;
  const OKNO_CZESC = 0.1, OKNO_MIN_S = 0.12;   // okienko trafienia: ±10% odstępu, najmniej ±0,12 s
  const met = { ctx: null, timer: null, nast: 0, k: 0, krok: 0, rodzaj: 'brak', glowne: [], dobre: 0, slabe: 0 };
  function odblokujDzwiek() {
    // Przeglądarki pozwalają na dźwięk dopiero po kliknięciu — wołane z obsługi kliknięcia
    if (ustawienia().metronom === 'brak') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!met.ctx) {
      try { met.ctx = new AC(); } catch (e) { met.ctx = null; return; }
    }
    if (met.ctx.state === 'suspended') met.ctx.resume().catch(() => {});
  }
  function stuk(czas, hz, glosnosc, dlugosc, fala = 'sine') {
    const c = met.ctx;
    const osc = c.createOscillator();
    const gl = c.createGain();
    osc.type = fala;
    osc.frequency.value = hz;
    gl.gain.setValueAtTime(0.0001, czas);
    gl.gain.exponentialRampToValueAtTime(glosnosc, czas + 0.004);
    gl.gain.exponentialRampToValueAtTime(0.0001, czas + dlugosc);
    osc.connect(gl).connect(c.destination);
    osc.start(czas);
    osc.stop(czas + dlugosc + 0.02);
  }
  const DZWIEKI = {
    zwykly: (t) => stuk(t, 760, 0.18, 0.05, 'triangle'),
    przed: (t) => stuk(t, 1320, 0.22, 0.09),
    glowny: (t) => stuk(t, 440, 0.3, 0.3),
    podzial: (t) => stuk(t, 440, 0.07, 0.12),
    premia: (t) => { stuk(t, 880, 0.1, 0.35); stuk(t, 1320, 0.06, 0.4); },
  };
  function planujMetronom() {
    const c = met.ctx;
    while (met.nast < c.currentTime + 0.12) {
      met.k++;
      if (met.rodzaj === 'prog') DZWIEKI[g.i >= met.k ? 'przed' : 'zwykly'](met.nast);
      else if ((met.k - 1) % SPOKOJNY_AKCENT === 0) {
        DZWIEKI.glowny(met.nast);
        met.glowne.push(met.nast);
        if (met.glowne.length > 6) met.glowne.shift();
      } else DZWIEKI.podzial(met.nast);
      met.nast += met.krok;
    }
  }
  function startMetronomu() {
    zatrzymajMetronom();
    met.rodzaj = ustawienia().metronom;
    if (met.rodzaj === 'brak' || !met.ctx) return;
    if (met.ctx.state !== 'running') {
      // pierwsze kliknięcie dopiero budzi dźwięk — wystartuj, gdy się obudzi (jeśli plansza nadal trwa)
      met.ctx.resume().then(() => { if (g.trwa && !met.timer && met.ctx.state === 'running') startMetronomu(); }).catch(() => {});
      return;
    }
    met.krok = met.rodzaj === 'prog' ? g.prog : ustawienia().rytm / SPOKOJNY_AKCENT;
    met.k = 0;
    met.glowne = [];
    g.rytmiczna = met.rodzaj === 'spokojny';
    // rytm progu: pierwsze stuknięcie po czasie jednego pola; spokojny: od razu główne uderzenie
    met.nast = met.ctx.currentTime + (met.rodzaj === 'prog' ? met.krok : 0.05);
    planujMetronom();
    met.timer = setInterval(planujMetronom, 25);
  }
  function zatrzymajMetronom() {
    clearInterval(met.timer);
    met.timer = null;
  }
  // Próbka po zmianie ustawienia, żeby było słychać, jak brzmi
  function probkaMetronomu() {
    odblokujDzwiek();
    const rodzaj = ustawienia().metronom;
    if (rodzaj === 'brak' || !met.ctx) return;
    const t = met.ctx.currentTime + 0.05;
    if (rodzaj === 'prog') { DZWIEKI.zwykly(t); DZWIEKI.zwykly(t + 0.6); DZWIEKI.przed(t + 1.2); }
    else {
      const k = ustawienia().rytm / SPOKOJNY_AKCENT;
      DZWIEKI.glowny(t); DZWIEKI.podzial(t + k); DZWIEKI.podzial(t + 2 * k); DZWIEKI.glowny(t + 3 * k); DZWIEKI.premia(t + 3 * k);
    }
  }
  // Czas kliknięcia na zegarze dźwięku — tak, jak słychać (z opóźnieniem głośnika; słuchawki Bluetooth
  // dokładają 150–300 ms, przeglądarka nie zawsze to zgłasza)
  function czasSlyszany(znacznik) {
    const c = met.ctx;
    if (c.getOutputTimestamp) {
      const o = c.getOutputTimestamp();
      if (o.contextTime > 0 && o.performanceTime > 0) return o.contextTime + (znacznik - o.performanceTime) / 1000;
    }
    return c.currentTime - (c.outputLatency || c.baseLatency || 0);
  }
  function ocenTrafienieRytmu(znacznik) {
    if (!g.rytmiczna || !met.ctx || !met.glowne.length) return;
    const t = czasSlyszany(znacznik);
    const rytm = ustawienia().rytm;
    const okno = Math.max(OKNO_MIN_S, OKNO_CZESC * rytm);
    const odleglosc = Math.min(...met.glowne.map((x) => Math.abs(t - x)));
    if (odleglosc > okno) return;
    g.wRytmie++;
    DZWIEKI.premia(met.ctx.currentTime + 0.01);
    T.migniecie(ramka, 'w-rytmie', 350);
  }
  // Po planszy w spokojnym rytmie: wynik trafień i ewentualna zmiana rytmu (dwie plansze z rzędu)
  function ocenPlanszeRytmu() {
    const u = ustawienia();
    const ile = g.kolejka.length;
    const czesc = g.wRytmie / ile;
    met.dobre = czesc >= RYTM_DOBRZE ? met.dobre + 1 : 0;
    met.slabe = czesc < RYTM_SLABO ? met.slabe + 1 : 0;
    let tytul = czesc >= RYTM_DOBRZE ? `W rytmie! Jeszcze ${POD_RZAD - met.dobre} do szybszego` : 'Dobrze, ten sam rytm';
    if (met.dobre >= POD_RZAD) {
      const nowy = Math.max(RYTM_MIN, Math.round(u.rytm * RYTM_KROK * 100) / 100);
      tytul = nowy < u.rytm ? `Rytm odrobinę szybszy: co ${T.ulamek(nowy, 2)} s` : 'Świetnie, to najszybszy rytm';
      u.rytm = nowy;
      met.dobre = 0;
      met.slabe = 0;
    } else if (met.slabe >= POD_RZAD) {
      const nowy = Math.min(RYTM_MAX, Math.round((u.rytm / RYTM_KROK) * 100) / 100);
      tytul = nowy > u.rytm ? `Rytm odrobinę wolniejszy: co ${T.ulamek(nowy, 2)} s` : 'Spokojnie, to najwolniejszy rytm';
      u.rytm = nowy;
      met.dobre = 0;
      met.slabe = 0;
    }
    return { tytul, czesc, tekst: `w rytmie ${g.wRytmie} z ${ile} (${Math.round(czesc * 100)}%)` };
  }

  // 0 › A, 25 › Z, 26 › AA … (przy 10×10 ostatnia to CV)
  function litera(i) {
    let w = '';
    for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) w = String.fromCharCode(65 + (n % 26)) + w;
    return w;
  }

  function czytajUstawienia() {
    g.n = s.aktywna ? s.n : Math.min(10, Math.max(MIN_N, Number($('s-rozmiar').value) || 5));
    g.znaki = $('s-znaki').value === 'litery' ? 'litery' : 'liczby';
    g.kolejka = Array.from({ length: g.n * g.n }, (_, i) => (g.znaki === 'liczby' ? String(i + 1) : litera(i)));
  }

  function pokazNakladke(tytul, tekst, przycisk) {
    $('s-nakl-tytul').textContent = tytul;
    $('s-nakl-tekst').textContent = tekst;
    $('s-start').textContent = przycisk;
    nakladka.hidden = false;
  }

  function opisLimitu() {
    const d = ustawienia().dlugosc;
    return d.endsWith('m') ? `${parseInt(d, 10)} minut` : `${d} plansz`;
  }

  function pokaz() {
    const ile = g.kolejka.length;
    const seria = trybSerii();
    $('s-cel').textContent = g.i < ile ? g.kolejka[g.i] : '—';
    $('s-postep').textContent = `${g.i} z ${ile}`;
    $('s-bledy').textContent = String(g.bledy);
    pokazTempo();
    $('s-przerwij').textContent = s.aktywna ? 'Zakończ Flow' : 'Przerwij';

    $('s-seria-pasek').hidden = !s.aktywna;
    if (s.aktywna) {
      $('s-poziom').textContent = rozmiar(s.n);
      $('s-awans').replaceChildren(...Array.from({ length: POD_RZAD }, (_, i) => el('span', i < s.dobre ? 'pelna' : '')));
      $('s-czas-pod').textContent = s.limitMs
        ? `zostało ${minSek(s.limitMs - (performance.now() - s.start))}`
        : `plansza ${Math.min(s.plansze.length + (s.czeka ? 0 : 1), s.limitPlansz)} z ${s.limitPlansz}`;
    } else {
      $('s-czas-pod').textContent = ' ';
    }

    if (seria) {
      $('s-trzeci').textContent = 'Tempo na pole';
      $('s-rekord').textContent = s.ostatnia ? `${T.ulamek(s.ostatnia.tempo, 2)} s` : '—';
      $('s-rekord-pod').textContent = `próg ${opisProgu(progDla(g.n))}`;
    } else {
      const r = T.stan.schulte.rekordy[klucz()];
      $('s-trzeci').textContent = 'Rekord';
      $('s-rekord').textContent = r ? `${T.ulamek(r, 2)} s` : '—';
      $('s-rekord-pod').textContent = `${rozmiar(g.n)}, ${g.znaki}`;
    }
  }

  function historia() {
    const ul = $('s-historia');
    if (trybSerii()) {
      $('s-hist-tytul').textContent = 'Ostatnie sesje Flow';
      T.pokazHistorie(ul, ustawienia().historia, (w) => ({
        tytul: `${w.plansze} ${T.odmiana(w.plansze, 'plansza', 'plansze', 'plansz')}, ${rozmiar(w.od)}${w.najwyzszy !== w.od ? ` › ${rozmiar(w.najwyzszy)}` : ''}`,
        wartosc: `${w.rytmiczna ? `${Math.round(w.wzgl * RYTM_DOBRZE * 100)}% w rytmie` : `${Math.round(w.wzgl * 100)}% progu`}${w.podp ? `, podpowiedzi: ${w.podp}` : ''}`,
      }));
    } else {
      $('s-hist-tytul').textContent = 'Ostatnie wyniki';
      T.pokazHistorie(ul, T.stan.schulte.historia, (w) => ({
        tytul: `${rozmiar(w.n)} ${w.znaki}`,
        wartosc: `${T.ulamek(w.czas, 2)} s${w.bledy ? `, pomyłki: ${w.bledy}` : ''}${w.podp ? `, podpowiedzi: ${w.podp}` : ''}`,
      }));
    }
  }

  function zatrzymajPlansze() {
    clearInterval(g.zegar);
    g.zegar = null;
    g.trwa = false;
    zatrzymajMetronom();
  }
  function zatrzymajOdliczanie() {
    clearInterval(s.odliczanie);
    s.odliczanie = null;
  }

  // Ekran przed startem (bez gry)
  function przygotuj() {
    zatrzymajPlansze();
    zatrzymajOdliczanie();
    s.aktywna = false;
    s.czeka = false;
    czytajUstawienia();
    g.i = 0;
    g.bledy = 0;
    T.ustawPlansze(plansza, g.n, T.tasuj(g.kolejka));
    $('s-czas').textContent = '0,0 s';
    if (trybSerii()) {
      const sufit = ustawienia().sufit;
      const o = progDla(Math.min(g.n, sufit));
      pokazNakladke('Flow',
        ustawienia().metronom === 'spokojny'
          ? `${opisLimitu()} na ${rozmiar(Math.min(g.n, sufit))} w spokojnym rytmie: główne uderzenie co ${T.ulamek(ustawienia().rytm, 2)} s — trafiaj w nie. Dwie plansze z rzędu z 80% trafień w rytm przyspieszają rytm odrobinę.`
          : `${opisLimitu()} od ${rozmiar(Math.min(g.n, sufit))}, najwyżej do ${rozmiar(sufit)}. Awans: dwie plansze z rzędu szybciej niż ${sPole(o.prog)}${o.wlasny ? ' (Twój próg)' : ''}.`,
        'Start Flow');
      pokazProgi();
    } else {
      pokazNakladke(`Tablica ${rozmiar(g.n)}`,
        `Klikaj po kolei od ${g.kolejka[0]} do ${g.kolejka[g.kolejka.length - 1]}. Czas liczy się od kliknięcia Start.${ustawienia().metronom === 'spokojny' ? ` Spokojny rytm co ${T.ulamek(ustawienia().rytm, 2)} s: znajdź znak i kliknij go na główne uderzenie.` : ''}`, 'Start');
    }
    pokaz();
  }

  function startPlanszy() {
    zatrzymajOdliczanie();
    s.czeka = false;
    czytajUstawienia();
    g.i = 0;
    g.bledy = 0;
    T.ustawPlansze(plansza, g.n, T.tasuj(g.kolejka));
    nakladka.hidden = true;
    ramka.classList.remove('wygrana');
    g.trwa = true;
    g.start = performance.now();
    g.podp = 0;
    g.etap = 0;
    g.rytmiczna = false;
    g.wRytmie = 0;
    g.ostatnie = g.start;
    const prog = progDla(g.n).prog;
    g.prog = prog;
    g.poMs = Math.max(PODP_MIN_S, PODP_RAZY * prog) * 1000;
    g.poleMs = g.poMs + Math.max(POLE_MIN_S, POLE_RAZY * prog) * 1000;
    clearInterval(g.zegar);
    g.zegar = setInterval(() => {
      $('s-czas').textContent = `${T.ulamek((performance.now() - g.start) / 1000)} s`;
      sprawdzPodpowiedz();
      pokazTempo();
      if (s.aktywna && s.limitMs) $('s-czas-pod').textContent = `zostało ${minSek(s.limitMs - (performance.now() - s.start))}`;
    }, 100);
    startMetronomu();
    pokaz();
  }

  function startJednej() {
    $('s-podsumowanie').hidden = true;
    startPlanszy();
    T.trybGry(true, modul);
  }

  function startSerii() {
    const u = ustawienia();
    s.sufit = u.sufit;
    s.n = Math.min(s.sufit, Math.max(MIN_N, Number($('s-rozmiar').value) || 5));
    s.limitPlansz = u.dlugosc.endsWith('m') ? 1000 : Number(u.dlugosc);
    s.limitMs = u.dlugosc.endsWith('m') ? parseInt(u.dlugosc, 10) * 60000 : 0;
    s.plansze = [];
    s.dobre = 0;
    s.slabe = 0;
    s.ostatnia = null;
    s.start = performance.now();
    s.aktywna = true;
    $('s-podsumowanie').hidden = true;
    startPlanszy();
    T.trybGry(true, modul);
  }

  function koniecPlanszy() {
    const czas = Math.round(performance.now() - g.start) / 1000;
    zatrzymajPlansze();
    const z = T.stan.schulte;
    const poprzedni = z.rekordy[klucz()];
    const rekord = !g.podp && (!poprzedni || czas < poprzedni);   // plansza z podpowiedzią nie bije rekordu
    if (rekord) z.rekordy[klucz()] = czas;
    $('s-czas').textContent = `${T.ulamek(czas, 2)} s`;
    T.migniecie(ramka, 'wygrana', 600);
    // próg liczony przed dopisaniem tej planszy — ocenia ją Twoje dotychczasowe tempo
    const prog = progDla(g.n);
    // tempo z podpowiedzią albo w spokojnym rytmie (celowo wolne) nie zmienia progu
    if (!g.podp && !g.rytmiczna) zapamietajTempo(g.n, g.znaki, czas / (g.n * g.n));
    const rytm = g.rytmiczna ? ocenPlanszeRytmu() : null;

    if (s.aktywna) { poPlanszySerii(czas, prog, rekord && Boolean(poprzedni), rytm); return; }   // w serii tylko pobity rekord

    T.dopisz(z.historia, { kiedy: Date.now(), n: g.n, znaki: g.znaki, czas, bledy: g.bledy, rekord, podp: g.podp });
    T.zapisz();
    pokazNakladke(rekord ? 'Nowy rekord!' : 'Gotowe',
      `${T.ulamek(czas, 2)} s, pomyłki: ${g.bledy}${g.podp ? `, podpowiedzi: ${g.podp} (bez rekordu)` : ''}.${!rekord && poprzedni ? ` Rekord: ${T.ulamek(poprzedni, 2)} s.` : ''}${rytm ? ` Spokojny rytm: ${rytm.tekst}. ${rytm.tytul}.` : ''}`, 'Jeszcze raz');
    T.trybGry(false, ramka);
    pokaz();
    historia();
  }

  // Decyzja po planszy w serii: awans, spadek albo ten sam poziom
  function poPlanszySerii(czas, progInfo, rekord, rytm) {
    const n = g.n;
    const tempo = czas / (n * n);
    const prog = progInfo.prog;
    // w spokojnym rytmie rozmiar zmienia się tylko po pomyłkach — rozwojem jest szybszy rytm
    const szybko = !rytm && tempo <= prog && g.bledy <= MAX_BLEDOW_AWANS && g.podp <= MAX_PODP_AWANS;
    const wolno = (!rytm && tempo > ZA_WOLNO * prog) || g.bledy >= BLEDY_SPADEK;
    // na wykresie: zwykle tempo względem progu, w spokojnym rytmie trafienia względem 80% (kreska = 80% w rytmie)
    const wzgl = rytm ? Math.max(0.01, rytm.czesc / RYTM_DOBRZE) : prog / tempo;
    const wpis = { n, czas, tempo, bledy: g.bledy, podp: g.podp, wzgl, zmiana: 0, rytm: Boolean(rytm) };
    s.plansze.push(wpis);
    s.ostatnia = wpis;
    s.dobre = szybko ? s.dobre + 1 : 0;
    s.slabe = wolno ? s.slabe + 1 : 0;
    T.zapisz();   // tempo i rekord zostają, nawet gdy ktoś zamknie kartę w połowie Flow

    let tytul;
    if (s.dobre >= POD_RZAD) {
      if (s.n < s.sufit) { s.n++; wpis.zmiana = 1; tytul = `Awans: ${rozmiar(s.n)}`; } else tytul = `Świetnie, to najwyższy ustawiony poziom`;
      s.dobre = 0;
      s.slabe = 0;
    } else if (s.slabe >= POD_RZAD) {
      if (s.n > MIN_N) { s.n--; wpis.zmiana = -1; tytul = `Spokojniej: ${rozmiar(s.n)}`; } else tytul = 'Zostajemy przy 3×3';
      s.dobre = 0;
      s.slabe = 0;
    } else if (rytm) {
      tytul = rytm.tytul;
    } else if (szybko) {
      tytul = `Szybko! Jeszcze ${POD_RZAD - s.dobre} do awansu`;
    } else if (wolno) {
      tytul = 'Wolniej niż zwykle';
    } else {
      tytul = 'Dobrze, ten sam poziom';
    }
    const opis = `${rozmiar(n)}: ${rytm ? rytm.tekst : `${sPole(tempo)} (próg ${T.ulamek(prog, 2)}${progInfo.wlasny ? ', Twój' : ''})`}${g.bledy ? `, pomyłki: ${g.bledy}` : ''}${g.podp ? `, podpowiedzi: ${g.podp}` : ''}.${rekord ? ' Rekord tej tablicy!' : ''}`;

    const koniec = s.plansze.length >= s.limitPlansz || (s.limitMs && performance.now() - s.start >= s.limitMs);
    if (koniec) { koniecSerii(); return; }

    // Krótka pauza i następna plansza sama
    s.czeka = true;
    let zostalo = PAUZA_S;
    const odswiez = () => pokazNakladke(tytul, `${opis} Następna za ${zostalo} s.`, 'Dalej');
    odswiez();
    pokaz();
    zatrzymajOdliczanie();
    s.odliczanie = setInterval(() => {
      zostalo--;
      if (zostalo <= 0) startPlanszy();
      else odswiez();
    }, 1000);
  }

  function koniecSerii() {
    zatrzymajPlansze();
    zatrzymajOdliczanie();
    s.czeka = false;
    const p = s.plansze;
    s.aktywna = false;
    const u = ustawienia();
    u.poziom = s.n;   // następna seria zacznie od poziomu, na którym ta się skończyła
    if (!p.length) { T.zapisz(); przygotuj(); T.trybGry(false, ramka); return; }

    const awanse = p.filter((x) => x.zmiana > 0).length;
    const spadki = p.filter((x) => x.zmiana < 0).length;
    const wzgl = p.reduce((a, x) => a + x.wzgl, 0) / p.length;
    const najwyzszy = Math.max(...p.map((x) => x.n));
    const najlepsza = p.reduce((a, x) => (x.wzgl > a.wzgl ? x : a));
    const podp = p.reduce((a, x) => a + x.podp, 0);
    const rytmiczna = p.every((x) => x.rytm);
    T.dopisz(u.historia, { kiedy: Date.now(), plansze: p.length, od: p[0].n, najwyzszy, wzgl: Math.max(0.01, Math.round(wzgl * 1000) / 1000), awanse, spadki, znaki: g.znaki, rekord: false, podp, rytmiczna });
    T.zapisz();

    $('s-pods-tekst').textContent = `Flow: ${p.length} ${T.odmiana(p.length, 'plansza', 'plansze', 'plansz')}, od ${rozmiar(p[0].n)}, najwyżej ${rozmiar(najwyzszy)} `
      + (rytmiczna
        ? `w spokojnym rytmie. Średnio ${Math.round(wzgl * RYTM_DOBRZE * 100)}% trafień w rytm, rytm teraz co ${T.ulamek(u.rytm, 2)} s. `
        : `(awanse: ${awanse}, spadki: ${spadki}). Średnio ${Math.round(wzgl * 100)}% progu, najlepsza: ${rozmiar(najlepsza.n)}, ${sPole(najlepsza.tempo)}. `)
      + `${podp ? `Podpowiedzi: ${podp}. ` : ''}Następny Flow zacznie od ${rozmiar(s.n)}.`;
    wykres(p);
    $('s-pods-opis').textContent = rytmiczna
      ? 'Słupek to trafienia w rytm na planszy: nad kreską 80% i więcej. Pod słupkiem rozmiar tablicy.'
      : 'Słupek to tempo planszy względem progu jej poziomu: nad kreską szybciej niż próg. Pod słupkiem rozmiar tablicy.';
    $('s-podsumowanie').hidden = false;
    $('s-rozmiar').value = String(s.n);
    czytajUstawienia();
    pokazProgi();
    pokazNakladke('Flow zakończony', 'Podsumowanie jest nad tablicą.', 'Jeszcze raz');
    T.trybGry(false, $('s-podsumowanie'));
    pokaz();
    historia();
  }

  // Słupki: tempo planszy względem progu (100% = próg), kreska przerywana = próg
  function wykres(p) {
    const svg = $('s-wykres');
    const NS = 'http://www.w3.org/2000/svg';
    const nowy = (tag, atr, tekst) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(atr)) e.setAttribute(k, String(v));
      if (tekst !== undefined) e.textContent = tekst;
      return e;
    };
    const SZER = 300, GORA = 6, WYS = 76;
    const skala = Math.max(1.4, ...p.map((x) => x.wzgl)) * 1.05;
    const krok = SZER / p.length;
    const szer = Math.min(28, krok * 0.7);
    const y = (v) => GORA + WYS - (Math.min(v, skala) / skala) * WYS;
    const elementy = [];
    p.forEach((x, i) => {
      const xs = i * krok + (krok - szer) / 2;
      const klasa = x.wzgl >= 1 ? 'slupek dobry' : (x.wzgl < 1 / ZA_WOLNO ? 'slupek slaby' : 'slupek');
      elementy.push(nowy('rect', { class: klasa, x: xs.toFixed(1), y: y(x.wzgl).toFixed(1), width: szer.toFixed(1), height: (GORA + WYS - y(x.wzgl)).toFixed(1), rx: 2 }));
      elementy.push(nowy('text', { x: (i * krok + krok / 2).toFixed(1), y: 96, 'text-anchor': 'middle' }, String(x.n)));
    });
    elementy.push(nowy('line', { class: 'prog', x1: 0, x2: SZER, y1: y(1).toFixed(1), y2: y(1).toFixed(1) }));
    svg.replaceChildren(...elementy);
    svg.setAttribute('aria-label', `Tempo ${p.length} plansz względem progu: ${p.map((x) => `${rozmiar(x.n)} ${Math.round(x.wzgl * 100)}%`).join(', ')}`);
  }

  function zmienTryb() {
    const u = ustawienia();
    u.tryb = trybSerii() ? 'seria' : 'jedna';
    document.querySelectorAll('#m-schulte .tylko-seria').forEach((e) => { e.hidden = u.tryb !== 'seria'; });
    $('s-rozmiar-etykieta').textContent = u.tryb === 'seria' ? 'Zacznij od' : 'Rozmiar';
    if (u.tryb === 'seria') $('s-rozmiar').value = String(Math.min(u.poziom, u.sufit));
    $('s-podsumowanie').hidden = true;
    s.ostatnia = null;
    T.zapisz();
    przygotuj();
    historia();
  }

  plansza.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pole-planszy');
    if (!b || !g.trwa || b.classList.contains('trafione')) return;
    if (b.dataset.v === g.kolejka[g.i]) {
      ocenTrafienieRytmu(ev.timeStamp);
      zgasPodpowiedz();
      g.i++;
      pokazTempo();
      if ($('s-wygaszaj').checked) b.classList.add('trafione');
      else T.migniecie(b, 'blysk-dobry', 180);
      if (g.i >= g.kolejka.length) koniecPlanszy();
      else pokaz();
    } else {
      g.bledy++;
      T.migniecie(b, 'blysk-zly', 260);
      pokaz();
    }
  });
  $('s-start').addEventListener('click', () => {
    odblokujDzwiek();
    if (s.czeka) startPlanszy();            // „Dalej” w pauzie serii
    else if (trybSerii()) startSerii();
    else startJednej();
  });
  $('s-tryb').addEventListener('change', zmienTryb);
  $('s-rozmiar').addEventListener('change', przygotuj);
  $('s-znaki').addEventListener('change', przygotuj);
  $('s-dlugosc').addEventListener('change', () => { ustawienia().dlugosc = $('s-dlugosc').value; T.zapisz(); przygotuj(); });
  $('s-podpowiedzi').addEventListener('change', () => { ustawienia().podpowiedzi = $('s-podpowiedzi').value; T.zapisz(); });
  $('s-metronom').addEventListener('change', () => {
    ustawienia().metronom = $('s-metronom').value;
    T.zapisz();
    probkaMetronomu();
    przygotuj();   // opis na planszy zależy od rytmu
  });
  $('s-tempo-tryb').addEventListener('change', () => {
    ustawienia().tempo = $('s-tempo-tryb').value;
    zastosujTempo();
    T.zapisz();
    pokaz();
  });
  $('s-paleta').addEventListener('change', () => {
    ustawienia().paleta = $('s-paleta').value;
    zastosujTempo();
    T.zapisz();
  });
  $('s-sufit').addEventListener('change', () => {
    const u = ustawienia();
    u.sufit = Number($('s-sufit').value) || 7;
    if (Number($('s-rozmiar').value) > u.sufit) $('s-rozmiar').value = String(u.sufit);
    T.zapisz();
    przygotuj();
  });
  $('s-punkt').addEventListener('change', () => { $('s-punkt-srodek').hidden = !$('s-punkt').checked; });
  $('s-wyczysc').addEventListener('click', () => {
    const z = T.stan.schulte;
    if (trybSerii()) {
      if (!z.seria.historia.length && !Object.keys(z.seria.tempa).length) return;
      if (!confirm('Usunąć historię sesji Flow, Twoje progi i tempo spokojnego rytmu (wrócą domyślne)? Rekordy tablic zostają.')) return;
      z.seria.historia = [];
      z.seria.tempa = {};
      z.seria.rytm = RYTM_START;
    } else {
      if (!z.historia.length && !Object.keys(z.rekordy).length) return;
      if (!confirm('Usunąć wyniki i rekordy tablicy Schultego?')) return;
      z.rekordy = {};
      z.historia = [];
    }
    T.zapisz();
    przygotuj();   // odświeża też progi i opis na planszy
    historia();
  });

  T.moduly.schulte = {
    wejdz() {
      const u = ustawienia();
      $('s-tryb').value = u.tryb;
      $('s-dlugosc').value = u.dlugosc;
      $('s-sufit').value = String(u.sufit);
      $('s-podpowiedzi').value = u.podpowiedzi;
      $('s-tempo-tryb').value = u.tempo;
      $('s-paleta').value = u.paleta;
      $('s-metronom').value = u.metronom;
      zastosujTempo();
      zmienTryb();
    },
    wyjdz() { zatrzymajPlansze(); zatrzymajOdliczanie(); s.aktywna = false; s.czeka = false; },
    przerwij() {
      if (s.aktywna) { koniecSerii(); return; }   // zakończona plansza się liczy, przerwana nie
      przygotuj();
      T.trybGry(false, ramka);
    },
    wTle() {
      // Karta w tle w czasie pauzy: nie startuj planszy sama, poczekaj na „Dalej”
      if (s.czeka && s.odliczanie) {
        zatrzymajOdliczanie();
        $('s-nakl-tekst').textContent = `${$('s-nakl-tekst').textContent.replace(/ Następna za \d+ s\.$/, '')} Kliknij „Dalej”, gdy wrócisz.`;
      }
    },
  };
})();
