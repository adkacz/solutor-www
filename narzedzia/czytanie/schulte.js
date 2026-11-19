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

  // Próg „świetnie” w sekundach na pole — szacunki na start, do dostrojenia po pierwszych seriach
  const PROG = { 3: 0.45, 4: 0.55, 5: 0.65, 6: 0.75, 7: 0.85, 8: 0.95, 9: 1.05, 10: 1.15 };
  const ZA_WOLNO = 1.6;          // tempo wolniejsze niż 1,6 × próg = plansza „za trudna”
  const MAX_BLEDOW_AWANS = 1;
  const BLEDY_SPADEK = 4;
  const POD_RZAD = 2;            // ile plansz z rzędu daje awans albo spadek
  const PAUZA_S = 3;
  const MIN_N = 3;

  const g = { n: 5, znaki: 'liczby', kolejka: [], i: 0, bledy: 0, trwa: false, start: 0, zegar: null };
  const s = { aktywna: false, n: 5, sufit: 7, limitPlansz: 10, limitMs: 0, start: 0, plansze: [], dobre: 0, slabe: 0, odliczanie: null, czeka: false, ostatnia: null };

  const ustawienia = () => T.stan.schulte.seria;
  const trybSerii = () => $('s-tryb').value === 'seria';
  const klucz = () => `${g.n}_${g.znaki}`;
  const rozmiar = (n) => `${n}×${n}`;
  const sPole = (t) => `${T.ulamek(t, 2)} s/pole`;
  const minSek = (ms) => { const c = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };

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
    $('s-przerwij').textContent = s.aktywna ? 'Zakończ serię' : 'Przerwij';

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
      $('s-trzeci').textContent = 'Poprzednia';
      $('s-rekord').textContent = s.ostatnia ? `${T.ulamek(s.ostatnia.tempo, 2)} s` : '—';
      $('s-rekord-pod').textContent = `na pole, próg ${T.ulamek(PROG[g.n], 2)}`;
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
      $('s-hist-tytul').textContent = 'Ostatnie serie';
      T.pokazHistorie(ul, ustawienia().historia, (w) => ({
        tytul: `${w.plansze} ${T.odmiana(w.plansze, 'plansza', 'plansze', 'plansz')}, ${rozmiar(w.od)}${w.najwyzszy !== w.od ? ` › ${rozmiar(w.najwyzszy)}` : ''}`,
        wartosc: `${Math.round(w.wzgl * 100)}% progu`,
      }));
    } else {
      $('s-hist-tytul').textContent = 'Ostatnie wyniki';
      T.pokazHistorie(ul, T.stan.schulte.historia, (w) => ({
        tytul: `${rozmiar(w.n)} ${w.znaki}`,
        wartosc: `${T.ulamek(w.czas, 2)} s${w.bledy ? `, pomyłki: ${w.bledy}` : ''}`,
      }));
    }
  }

  function zatrzymajPlansze() {
    clearInterval(g.zegar);
    g.zegar = null;
    g.trwa = false;
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
      pokazNakladke('Seria',
        `${opisLimitu()} od ${rozmiar(Math.min(g.n, sufit))}, najwyżej do ${rozmiar(sufit)}. Awans: dwie plansze z rzędu szybciej niż ${sPole(PROG[Math.min(g.n, sufit)])}.`,
        'Start serii');
    } else {
      pokazNakladke(`Tablica ${rozmiar(g.n)}`,
        `Klikaj po kolei od ${g.kolejka[0]} do ${g.kolejka[g.kolejka.length - 1]}. Czas liczy się od kliknięcia Start.`, 'Start');
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
    clearInterval(g.zegar);
    g.zegar = setInterval(() => {
      $('s-czas').textContent = `${T.ulamek((performance.now() - g.start) / 1000)} s`;
      if (s.aktywna && s.limitMs) $('s-czas-pod').textContent = `zostało ${minSek(s.limitMs - (performance.now() - s.start))}`;
    }, 100);
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
    const rekord = !poprzedni || czas < poprzedni;
    if (rekord) z.rekordy[klucz()] = czas;
    $('s-czas').textContent = `${T.ulamek(czas, 2)} s`;
    T.migniecie(ramka, 'wygrana', 600);

    if (s.aktywna) { poPlanszySerii(czas, rekord && Boolean(poprzedni)); return; }   // w serii tylko pobity rekord

    T.dopisz(z.historia, { kiedy: Date.now(), n: g.n, znaki: g.znaki, czas, bledy: g.bledy, rekord });
    T.zapisz();
    pokazNakladke(rekord ? 'Nowy rekord!' : 'Gotowe',
      `${T.ulamek(czas, 2)} s, pomyłki: ${g.bledy}.${!rekord && poprzedni ? ` Rekord: ${T.ulamek(poprzedni, 2)} s.` : ''}`, 'Jeszcze raz');
    T.trybGry(false, ramka);
    pokaz();
    historia();
  }

  // Decyzja po planszy w serii: awans, spadek albo ten sam poziom
  function poPlanszySerii(czas, rekord) {
    const n = g.n;
    const tempo = czas / (n * n);
    const prog = PROG[n];
    const szybko = tempo <= prog && g.bledy <= MAX_BLEDOW_AWANS;
    const wolno = tempo > ZA_WOLNO * prog || g.bledy >= BLEDY_SPADEK;
    const wpis = { n, czas, tempo, bledy: g.bledy, wzgl: prog / tempo, zmiana: 0 };
    s.plansze.push(wpis);
    s.ostatnia = wpis;
    s.dobre = szybko ? s.dobre + 1 : 0;
    s.slabe = wolno ? s.slabe + 1 : 0;

    let tytul;
    if (s.dobre >= POD_RZAD) {
      if (s.n < s.sufit) { s.n++; wpis.zmiana = 1; tytul = `Awans: ${rozmiar(s.n)}`; } else tytul = `Świetnie, to najwyższy poziom tej serii`;
      s.dobre = 0;
      s.slabe = 0;
    } else if (s.slabe >= POD_RZAD) {
      if (s.n > MIN_N) { s.n--; wpis.zmiana = -1; tytul = `Spokojniej: ${rozmiar(s.n)}`; } else tytul = 'Zostajemy przy 3×3';
      s.dobre = 0;
      s.slabe = 0;
    } else if (szybko) {
      tytul = `Szybko! Jeszcze ${POD_RZAD - s.dobre} do awansu`;
    } else if (wolno) {
      tytul = 'Wolniej niż zwykle';
    } else {
      tytul = 'Dobrze, ten sam poziom';
    }
    const opis = `${rozmiar(n)}: ${sPole(tempo)} (próg ${T.ulamek(prog, 2)})${g.bledy ? `, pomyłki: ${g.bledy}` : ''}.${rekord ? ' Rekord tej tablicy!' : ''}`;

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
    T.dopisz(u.historia, { kiedy: Date.now(), plansze: p.length, od: p[0].n, najwyzszy, wzgl: Math.round(wzgl * 1000) / 1000, awanse, spadki, znaki: g.znaki, rekord: false });
    T.zapisz();

    $('s-pods-tekst').textContent = `Seria: ${p.length} ${T.odmiana(p.length, 'plansza', 'plansze', 'plansz')}, od ${rozmiar(p[0].n)}, najwyżej ${rozmiar(najwyzszy)} `
      + `(awanse: ${awanse}, spadki: ${spadki}). Średnio ${Math.round(wzgl * 100)}% progu, najlepsza: ${rozmiar(najlepsza.n)}, ${sPole(najlepsza.tempo)}. `
      + `Następna seria zacznie od ${rozmiar(s.n)}.`;
    wykres(p);
    $('s-podsumowanie').hidden = false;
    $('s-rozmiar').value = String(s.n);
    czytajUstawienia();
    pokazNakladke('Seria zakończona', 'Podsumowanie jest nad tablicą.', 'Nowa seria');
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
      g.i++;
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
    if (s.czeka) startPlanszy();            // „Dalej” w pauzie serii
    else if (trybSerii()) startSerii();
    else startJednej();
  });
  $('s-tryb').addEventListener('change', zmienTryb);
  $('s-rozmiar').addEventListener('change', przygotuj);
  $('s-znaki').addEventListener('change', przygotuj);
  $('s-dlugosc').addEventListener('change', () => { ustawienia().dlugosc = $('s-dlugosc').value; T.zapisz(); przygotuj(); });
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
      if (!z.seria.historia.length) return;
      if (!confirm('Usunąć historię serii? Rekordy tablic zostają.')) return;
      z.seria.historia = [];
    } else {
      if (!z.historia.length && !Object.keys(z.rekordy).length) return;
      if (!confirm('Usunąć wyniki i rekordy tablicy Schultego?')) return;
      z.rekordy = {};
      z.historia = [];
    }
    T.zapisz();
    pokaz();
    historia();
  });

  T.moduly.schulte = {
    wejdz() {
      const u = ustawienia();
      $('s-tryb').value = u.tryb;
      $('s-dlugosc').value = u.dlugosc;
      $('s-sufit').value = String(u.sufit);
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
