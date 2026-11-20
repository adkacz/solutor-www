/* Trener czytania — wyszukiwanie pojęć. Dwa tryby:
   „Wyścig” — kilka ważnych słów z fragmentu klikanych w kolejności występowania, 60 s i poziomy;
   „Cały fragment” — bez limitu czasu odsłania się wszystkie słowa fragmentu porcjami, strona po stronie
   (bez przewijania), a na końcu czyta się całość.
   Tekst wybiera się w ćwiczeniu RSVP (T.biezacyTekst). Słowa wstawiane tylko przez textContent. */
'use strict';

(() => {
  const { $, el } = T;
  const STOP = new Set(('i w z do na o że co to się nie a od po ale oraz jego jej ich ty my on ona ono są był była było byli były ' +
    'będzie będą też już tylko jak tak za nad pod przez przed przy dla lub albo im niż aby żeby jest jako także jednak który która ' +
    'które którego której którym którzy tego temu tym tych taki taka takie takich jeśli gdyż więc może można bardzo nawet czyli ' +
    'każdy każda każde kiedy gdzie teraz sobie swoje swój swoją swojej również około wtedy potem dlatego ponieważ między pomiędzy ' +
    'podczas zamiast lecz nasz nasza nasze naszą wiele wszystko wszystkie bowiem tutaj tam nich niej nimi niego nawzajem często ' +
    'zwykle coraz wciąż jeszcze zawsze żaden żadne trzeba znacznie sposób').split(' '));
  const DLUGOSC = { 1: 35, 2: 65, 3: 100, 4: 140 };
  const CELE = { 1: 4, 2: 5, 3: 6, 4: 7 };
  const CZAS_GRY = 60, MAX_BONUS = 30, PODPOWIEDZ_PO_MS = 10000, SZYBKO_S = 10, NAGRODA_S = 5, MIN_SLOW = 12;
  const ZAPAS_FRAGMENTU = 1.4;   // fragment kończy się na końcu wersu albo zdania, ale nie dalej niż 1,4 × długość

  const modul = $('m-pojecia');
  const scena = $('j-scena');
  const kotwica = scena.parentElement;
  const g = {
    aktywna: false, poziom: 1, slowa: [], kolejka: [], k: 0, przesuniecie: 0,
    czas: CZAS_GRY, bonus: 0, wynik: 0, ukonczone: 0, bledy: 0,
    tik: 0, ostatnie: 0, startPoziomu: 0, podpowiedz: false, zegar: null, nastepny: null,
  };
  // Tryb „Cały fragment”: elementy fragmentu, strony, porcje celów i stan etapu
  const c = {
    etap: '', elementy: [], strony: [], s: 0, porcje: [], p: 0, k: 0,
    szukanie: 0, czytanie: 0, bledy: 0, podp: 0, odkryte: 0, slow: 0,
    przesuniecie: 0, nastepne: 0, zrodlo: '', dlugosc: '', etykieta: '',
  };
  const czysty = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const naWidok = (t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || t;
  const tokeny = () => T.biezacyTekst().tresc.split(/\s+/).filter(Boolean);
  const tryb = () => T.stan.pojecia.tryb;
  const ustawCaly = () => T.stan.pojecia.caly;
  function czasTekst(s) {
    const r = Math.round(s);
    if (r < 60) return `${r} s`;
    return r % 60 ? `${Math.floor(r / 60)} min ${r % 60} s` : `${r / 60} min`;
  }

  // ================= Wyścig =================

  // Fragment dla poziomu: każdy poziom bierze dalszą część tekstu; gdy tekst się skończy — od początku
  function przygotujPoziom() {
    const wszystkie = tokeny();
    const dl = Math.min(wszystkie.length, DLUGOSC[g.poziom]);
    if (g.przesuniecie + dl > wszystkie.length) g.przesuniecie = 0;
    const wycinek = wszystkie.slice(g.przesuniecie, g.przesuniecie + dl);
    g.przesuniecie += dl;
    g.slowa = wycinek.map((t, i) => ({ t, c: czysty(t), i, klucz: false, ok: false }));

    const ile = {};
    g.slowa.forEach((s) => { ile[s.c] = (ile[s.c] || 0) + 1; });
    const merytoryczne = g.slowa.filter((s) => s.c.length >= 4 && !STOP.has(s.c));
    let kandydaci = merytoryczne.filter((s) => ile[s.c] === 1);   // najpierw słowa, które występują raz
    if (kandydaci.length < CELE[g.poziom]) kandydaci = merytoryczne;
    if (kandydaci.length < CELE[g.poziom]) kandydaci = g.slowa.filter((s) => s.c.length >= 2);
    // Kandydaci dzieleni na k równych odcinków; z każdego jedno losowe słowo — cele rozłożone po całym
    // fragmencie, a za każdym razem inne
    const k = Math.min(CELE[g.poziom], kandydaci.length);
    for (let j = 0; j < k; j++) {
      const odcinek = kandydaci.slice(Math.floor((j * kandydaci.length) / k), Math.floor(((j + 1) * kandydaci.length) / k));
      T.wybierz(odcinek).klucz = true;
    }
    g.kolejka = g.slowa.filter((s) => s.klucz);
    g.k = 0;
  }

  function rysuj() {
    const zaznacz = $('j-zaznacz').checked;
    scena.replaceChildren();
    for (const s of g.slowa) {
      const span = el('span', 'slowo', s.t);
      if (s.klucz && zaznacz) span.classList.add('klucz');
      if (s.ok) span.classList.add('znalezione');
      span.dataset.i = String(s.i);
      scena.append(span, ' ');
    }
    scena.scrollTop = 0;
  }

  const spanSlowa = (i) => scena.querySelector(`[data-i="${i}"]`);

  function pokaz() {
    const caly = tryb() === 'caly';
    for (const e of modul.querySelectorAll('[data-tryb]')) e.hidden = e.dataset.tryb !== (caly ? 'caly' : 'wyscig');
    const n = tokeny().length;
    $('j-tekst-info').textContent = `Wybrany tekst: ${n} ${T.odmiana(n, 'słowo', 'słowa', 'słów')}.`;
    if (caly) { pokazCaly(); return; }
    const cel = g.kolejka[g.k];
    const z = T.stan.pojecia;
    $('j-cel').previousElementSibling.textContent = 'Szukaj';
    $('j-cel').classList.add('cel-slowo');
    $('j-cel').textContent = g.aktywna && cel ? naWidok(cel.t) : '—';
    $('j-postep').textContent = g.aktywna && g.kolejka.length ? `${Math.min(g.k + 1, g.kolejka.length)} z ${g.kolejka.length}` : '';
    $('j-czas').textContent = `${T.ulamek(Math.max(0, g.czas))} s`;
    $('j-bonus').textContent = g.bonus >= MAX_BONUS ? 'bonus wykorzystany' : `bonus +${Math.round(g.bonus)}/${MAX_BONUS} s`;
    $('j-wynik').textContent = String(g.wynik);
    $('j-poziom').textContent = `poziom ${g.poziom} z 4`;
    $('j-rekord').textContent = String(z.rekord);
    $('j-rekord-pod').textContent = `najwyższy poziom: ${z.poziom}`;
    const pasek = $('j-pasek');
    pasek.style.width = `${Math.min(100, Math.max(0, (g.czas / CZAS_GRY) * 100))}%`;
    pasek.classList.toggle('malo', g.czas <= 10);
  }

  function historia() {
    if (tryb() === 'caly') {
      T.pokazHistorie($('j-historia'), ustawCaly().historia, (w) => ({
        tytul: `${w.slowa} ${T.odmiana(w.slowa, 'słowo', 'słowa', 'słów')}`,
        wartosc: `szukanie ${czasTekst(w.czas)}, pomyłki: ${w.bledy}, czytanie ${czasTekst(w.czytanie)}`,
      }));
      return;
    }
    T.pokazHistorie($('j-historia'), T.stan.pojecia.historia, (w) => ({
      tytul: `${w.wynik} pkt`,
      wartosc: `poziom ${w.poziom}, ukończone: ${w.ukonczone}`,
    }));
  }

  function zatrzymaj() {
    clearInterval(g.zegar);
    clearTimeout(g.nastepny);
    g.zegar = null;
    g.nastepny = null;
    g.aktywna = false;
    c.etap = '';
  }

  function spoczynek() {
    zatrzymaj();
    Object.assign(g, { czas: CZAS_GRY, bonus: 0, wynik: 0, ukonczone: 0, bledy: 0, kolejka: [], k: 0 });
    g.poziom = Number($('j-start-poziom').value) || 1;
    scena.hidden = true;
    scena.style.maxHeight = '';
    scena.classList.remove('strona');
    $('j-przeczytane').hidden = true;
    $('j-start-blok').hidden = false;
    const zaKrotki = tokeny().length < MIN_SLOW;
    $('j-start').disabled = zaKrotki;
    $('j-start-tekst').textContent = zaKrotki
      ? `Tekst jest za krótki (potrzeba co najmniej ${MIN_SLOW} słów). Wybierz albo wklej tekst w ćwiczeniu RSVP.`
      : tryb() === 'caly'
        ? 'Bez limitu czasu. Klikaj wskazane słowo wszędzie, gdzie występuje na stronie. Gdy odsłonisz cały fragment, przeczytasz go w całości.'
        : 'Masz 60 sekund. Pomyłka zabiera 1 s, a poziom ukończony w 10 s dodaje 5 s.';
    pokaz();
  }

  function start() {
    if (tokeny().length < MIN_SLOW) return;
    if (tryb() === 'caly') { startCaly(); return; }
    zatrzymaj();
    Object.assign(g, { czas: CZAS_GRY, bonus: 0, wynik: 0, ukonczone: 0, bledy: 0, przesuniecie: 0, aktywna: true });
    g.poziom = Number($('j-start-poziom').value) || 1;
    $('j-wynik-koniec').hidden = true;
    $('j-start-blok').hidden = true;
    scena.hidden = false;
    T.trybGry(true, modul);
    nowyPoziom();
    g.tik = performance.now();
    g.zegar = setInterval(tik, 80);
  }

  function nowyPoziom() {
    przygotujPoziom();
    rysuj();
    g.startPoziomu = performance.now();
    g.ostatnie = g.startPoziomu;
    g.podpowiedz = false;
    pokaz();
  }

  function tik() {
    if (!g.aktywna) return;
    const teraz = performance.now();
    g.czas -= (teraz - g.tik) / 1000;
    g.tik = teraz;
    if (g.czas <= 0) { g.czas = 0; koniec(); return; }
    if ($('j-podpowiedz').checked && !g.podpowiedz && teraz - g.ostatnie >= PODPOWIEDZ_PO_MS) {
      g.podpowiedz = true;
      const cel = g.kolejka[g.k];
      const span = cel && spanSlowa(cel.i);
      if (span) {
        span.classList.add('podpowiedz');
        scena.scrollTop = Math.max(0, span.offsetTop - scena.clientHeight / 2);
      }
    }
    $('j-czas').textContent = `${T.ulamek(g.czas)} s`;
    const pasek = $('j-pasek');
    pasek.style.width = `${Math.min(100, (g.czas / CZAS_GRY) * 100)}%`;
    pasek.classList.toggle('malo', g.czas <= 10);
  }

  function poziomUkonczony() {
    g.ukonczone++;
    const czasPoziomu = (performance.now() - g.startPoziomu) / 1000;
    if (czasPoziomu <= SZYBKO_S) {
      const zostalo = Math.max(0, MAX_BONUS - g.bonus);
      if (zostalo > 0) {
        const dodane = Math.min(NAGRODA_S, zostalo);
        g.czas = Math.min(CZAS_GRY, g.czas + dodane);
        g.bonus += dodane;
        T.odznaka(kotwica, `Szybko! +${dodane} s`);
      } else {
        g.wynik += 150;
        T.odznaka(kotwica, 'Szybko! +150 pkt', 'premia');
      }
    } else {
      T.odznaka(kotwica, 'Poziom ukończony');
    }
    if (g.poziom < 4) g.poziom++;
    else g.wynik += 200;   // premia za ukończenie najwyższego poziomu
    pokaz();
    g.nastepny = setTimeout(() => { if (g.aktywna) nowyPoziom(); }, 900);
  }

  function koniec() {
    zatrzymaj();
    const z = T.stan.pojecia;
    const rekord = g.wynik > z.rekord;
    if (rekord) z.rekord = g.wynik;
    if (g.poziom > z.poziom) z.poziom = g.poziom;
    T.dopisz(z.historia, { kiedy: Date.now(), wynik: g.wynik, poziom: g.poziom, ukonczone: g.ukonczone, rekord });
    T.zapisz();
    const w = $('j-wynik-koniec');
    w.textContent = `${rekord ? 'Nowy rekord! ' : 'Koniec czasu. '}Wynik: ${g.wynik} pkt, ukończone poziomy: ${g.ukonczone}, pomyłki: ${g.bledy}.`;
    w.hidden = false;
    const wynik = g.wynik, poziom = g.poziom;
    spoczynek();
    g.wynik = wynik;
    g.poziom = poziom;
    $('j-start').textContent = 'Jeszcze raz';
    pokaz();
    T.trybGry(false, w);
    historia();
  }

  function klikWyscig(span) {
    const s = g.slowa[Number(span.dataset.i)];
    const cel = g.kolejka[g.k];
    if (!s || s.ok || !cel) return;
    if (s.c === cel.c) {   // to samo słowo w innym miejscu fragmentu też się liczy
      s.ok = true;
      if (s !== cel) {
        cel.klucz = false;
        s.klucz = true;
        g.kolejka[g.k] = s;
        const stary = spanSlowa(cel.i);
        if (stary) stary.classList.remove('klucz', 'podpowiedz');
      }
      span.classList.remove('klucz', 'podpowiedz');
      span.classList.add('znalezione');
      g.k++;
      g.ostatnie = performance.now();
      g.podpowiedz = false;
      g.wynik += 25;
      T.odznaka(kotwica, '+25 pkt');
      if (g.k >= g.kolejka.length) poziomUkonczony();
      else pokaz();
    } else {
      g.bledy++;
      g.czas = Math.max(0.1, g.czas - 1);
      T.migniecie(span, 'zle', 300);
      T.odznaka(kotwica, 'Pomyłka: -1 s', 'kara');
      pokaz();
    }
  }

  // ================= Cały fragment =================

  // Tekst na elementy z zachowaniem wersów: { t } — słowo, { br: 1 } — nowy wers, { br: 2 } — nowa zwrotka
  function elementyTekstu() {
    const wynik = [];
    let puste = 0;
    for (const linia of T.biezacyTekst().tresc.replace(/\r\n?/g, '\n').split('\n')) {
      const slowa = linia.split(/\s+/).filter(Boolean);
      if (!slowa.length) { puste++; continue; }
      if (wynik.length) wynik.push({ br: puste ? 2 : 1 });
      puste = 0;
      for (const t of slowa) wynik.push({ t, c: czysty(t) });
    }
    return wynik;
  }

  // Fragment od c.przesuniecie: co najmniej „dlugosc” słów, dokończony do końca zwrotki albo zdania;
  // koniec wersu tylko w zapasie, gdy do limitu (1,4 × długość) nie ma ani jednego, ani drugiego
  function wytnijFragment(wszystkie) {
    const cel = Number(ustawCaly().fragment);
    const limit = Math.round(cel * ZAPAS_FRAGMENTU);
    if (c.przesuniecie >= wszystkie.length) c.przesuniecie = 0;
    let od = c.przesuniecie;
    while (od < wszystkie.length && wszystkie[od].br) od++;
    let slow = 0, i = od, zapas = null;
    for (; i < wszystkie.length; i++) {
      const e = wszystkie[i];
      if (e.br) {
        if (slow >= cel) {
          if (e.br === 2) break;
          if (zapas === null) zapas = i;
        }
        continue;
      }
      slow++;
      if (slow >= cel && /[.!?…]["”»)]*$/.test(e.t)) { i++; break; }
      if (slow >= limit) { i = zapas !== null ? zapas : i + 1; break; }
    }
    // Zostałaby końcówka krótsza niż jedna czwarta fragmentu — dołączamy ją
    const reszta = wszystkie.slice(i).filter((e) => !e.br).length;
    if (reszta && reszta < cel / 4) i = wszystkie.length;
    c.nastepne = i;
    return wszystkie.slice(od, i);
  }

  function startCaly() {
    zatrzymaj();
    const wszystkie = elementyTekstu();
    const zrodlo = T.biezacyTekst().tresc;
    if (zrodlo !== c.zrodlo || ustawCaly().fragment !== c.dlugosc) {
      c.przesuniecie = 0;
      c.etykieta = '';
      c.zrodlo = zrodlo;
      c.dlugosc = ustawCaly().fragment;
    }
    const fragment = wytnijFragment(wszystkie);
    c.elementy = fragment.map((e, i) => ({ ...e, i, ok: false }));
    c.slow = c.elementy.filter((e) => e.c).length;
    Object.assign(c, { szukanie: 0, czytanie: 0, bledy: 0, podp: 0, odkryte: 0, s: 0 });
    g.aktywna = true;
    $('j-wynik-koniec').hidden = true;
    $('j-start-blok').hidden = true;
    $('j-przeczytane').hidden = true;
    scena.hidden = false;
    T.trybGry(true, modul);
    podzielNaStrony();
    c.etap = 'szukanie';
    nowaStrona();
    g.tik = performance.now();
    g.zegar = setInterval(tikCaly, 100);
  }

  function rysujElementy(od, do_, czysto) {
    scena.replaceChildren();
    let poczatek = true;
    for (let i = od; i < do_; i++) {
      const e = c.elementy[i];
      if (e.br) {
        if (poczatek) continue;   // strona nie zaczyna się od pustego wersu
        scena.append(e.br === 2 ? el('span', 'zwrotka') : el('br'));
        continue;
      }
      poczatek = false;
      const span = el('span', e.c ? 'slowo' : 'znak', e.t);
      span.dataset.i = String(i);
      if (e.ok && !czysto) span.classList.add('odkryte');
      scena.append(span, ' ');
    }
    scena.scrollTop = 0;
  }

  // Wysokość od góry sceny do dołu ekranu, gdy T.trybGry przewinie stronę do góry modułu (8 px zapasu)
  function wysokoscNaScene(odjac) {
    const wysokoscOkna = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const odGory = scena.getBoundingClientRect().top - modul.getBoundingClientRect().top + 8;
    return Math.max(200, wysokoscOkna - odGory - odjac);
  }

  // Strony mieszczące się na ekranie: całość rysowana raz, słowa grupowane w wiersze po położeniu,
  // wiersze w strony o wysokości dostępnej pod wskaźnikami
  function podzielNaStrony() {
    scena.classList.add('strona');
    scena.style.maxHeight = 'none';
    rysujElementy(0, c.elementy.length, true);
    const styl = getComputedStyle(scena);
    const ramka = parseFloat(styl.paddingTop) + parseFloat(styl.paddingBottom) + parseFloat(styl.borderTopWidth) + parseFloat(styl.borderBottomWidth);
    const dostepna = wysokoscNaScene(12);
    const miejsce = dostepna - ramka;
    const wiersze = [];
    for (const span of scena.children) {
      if (span.tagName === 'BR') continue;
      const gora = span.offsetTop, dol = span.offsetTop + span.offsetHeight;
      const ostatni = wiersze[wiersze.length - 1];
      if (ostatni && Math.abs(gora - ostatni.gora) < 4) {
        ostatni.dol = Math.max(ostatni.dol, dol);
        ostatni.span.push(span);
      } else {
        wiersze.push({ gora, dol, span: [span] });
      }
    }
    // Indeks elementu, od którego zaczyna się każdy wiersz
    const poczatki = wiersze.map((w) => {
      const s = w.span.find((x) => x.dataset.i !== undefined);
      return s ? Number(s.dataset.i) : null;
    });
    c.strony = [];
    let od = 0, goraStrony = null;
    wiersze.forEach((w, n) => {
      if (poczatki[n] === null) return;   // sama przerwa między zwrotkami
      if (goraStrony === null) goraStrony = w.gora;
      if (w.dol - goraStrony > miejsce && poczatki[n] > od) {
        c.strony.push([od, poczatki[n]]);
        od = poczatki[n];
        goraStrony = w.gora;
      }
    });
    c.strony.push([od, c.elementy.length]);
    scena.style.maxHeight = `${dostepna}px`;
  }

  // Cele strony: wszystkie różne słowa w losowej kolejności, porcjami; w porcji według pierwszego wystąpienia
  function nowaStrona() {
    const [od, do_] = c.strony[c.s];
    const formy = new Map();
    for (let i = od; i < do_; i++) {
      const e = c.elementy[i];
      if (!e.c || e.ok) continue;
      if (!formy.has(e.c)) formy.set(e.c, { c: e.c, widok: naWidok(e.t), wystapienia: [], ile: 0 });
      formy.get(e.c).wystapienia.push(i);
    }
    const lista = T.tasuj([...formy.values()]);
    const n = ustawCaly().porcja;
    c.porcje = [];
    for (let j = 0; j < lista.length; j += n) {
      c.porcje.push(lista.slice(j, j + n).sort((a, b) => a.wystapienia[0] - b.wystapienia[0]));
    }
    c.p = 0;
    c.k = 0;
    rysujElementy(od, do_, false);
    g.ostatnie = performance.now();
    g.podpowiedz = false;
    pokaz();
  }

  const celCaly = () => (c.porcje[c.p] || [])[c.k];

  function pokazCaly() {
    const j = $('j-cel');
    if (c.etap === 'czytanie') {
      j.previousElementSibling.textContent = 'Czytaj';
      j.classList.remove('cel-slowo');
      j.textContent = 'cały fragment';
      $('j-postep').textContent = 'potem kliknij „Przeczytane”';
    } else {
      j.previousElementSibling.textContent = 'Szukaj';
      const cel = celCaly();
      j.classList.add('cel-slowo');
      j.textContent = g.aktywna && cel ? cel.widok : '—';
      const porcja = c.porcje[c.p] || [];
      $('j-postep').textContent = g.aktywna && cel
        ? `słowo ${c.k + 1} z ${porcja.length}${cel.wystapienia.length > 1 ? ` · na stronie ${cel.wystapienia.length} razy` : ''}`
        : '';
    }
    $('j-c-czas').textContent = czasTekst(c.etap === 'czytanie' ? c.czytanie : c.szukanie);
    $('j-c-czas-pod').textContent = c.etap === 'czytanie' ? `czytanie · szukanie ${czasTekst(c.szukanie)}` : 'bez limitu';
    $('j-c-odsl').textContent = `${c.odkryte} z ${c.slow}`;
    $('j-c-strona').textContent = c.strony.length ? `strona ${Math.min(c.s + 1, c.strony.length)} z ${c.strony.length}` : '';
    $('j-c-bledy').textContent = String(c.bledy);
    $('j-c-podp').textContent = `podpowiedzi: ${c.podp}`;
  }

  // Czas liczy się tylko przy widocznej karcie
  function tikCaly() {
    if (!g.aktywna) return;
    const teraz = performance.now();
    const dt = document.hidden ? 0 : Math.max(0, (teraz - g.tik) / 1000);
    g.tik = teraz;
    if (c.etap === 'szukanie') c.szukanie += dt;
    else if (c.etap === 'czytanie') c.czytanie += dt;
    if (c.etap === 'szukanie' && $('j-podpowiedz').checked && !g.podpowiedz && teraz - g.ostatnie >= PODPOWIEDZ_PO_MS) {
      const cel = celCaly();
      const i = cel && cel.wystapienia.find((x) => !c.elementy[x].ok);
      const span = i !== undefined && spanSlowa(i);
      if (span) {
        g.podpowiedz = true;
        c.podp++;
        span.classList.add('podpowiedz');
        scena.scrollTop = Math.max(0, span.offsetTop - scena.clientHeight / 2);
      }
    }
    $('j-c-czas').textContent = czasTekst(c.etap === 'czytanie' ? c.czytanie : c.szukanie);
  }
  document.addEventListener('visibilitychange', () => {
    if (!g.aktywna || tryb() !== 'caly') return;
    if (!document.hidden) { g.tik = performance.now(); g.ostatnie = performance.now(); }
  });

  function klikCaly(span) {
    if (c.etap !== 'szukanie') return;
    const i = Number(span.dataset.i);
    const e = c.elementy[i];
    const cel = celCaly();
    if (!e || e.ok || !cel) return;
    if (e.c !== cel.c) {
      c.bledy++;
      T.migniecie(span, 'zle', 300);
      T.odznaka(kotwica, 'To nie to słowo', 'kara');
      pokaz();
      return;
    }
    e.ok = true;
    cel.ile++;
    c.odkryte++;
    span.classList.remove('podpowiedz');
    span.classList.add('znalezione');
    g.ostatnie = performance.now();
    g.podpowiedz = false;
    const zostalo = cel.wystapienia.length - cel.ile;
    if (zostalo > 0) {
      for (const x of cel.wystapienia) { const s = spanSlowa(x); if (s) s.classList.remove('podpowiedz'); }
      T.odznaka(kotwica, `jeszcze ${zostalo}`);
      pokaz();
      return;
    }
    // Słowo skończone: jego wystąpienia przygasają, następny cel
    for (const x of cel.wystapienia) {
      const s = spanSlowa(x);
      if (s) { s.classList.remove('znalezione', 'podpowiedz'); s.classList.add('odkryte'); }
    }
    if (cel.wystapienia.length > 1) T.odznaka(kotwica, `Brawo, wszystkie ${cel.wystapienia.length}!`, 'premia');
    c.k++;
    if (c.k >= c.porcje[c.p].length) { c.p++; c.k = 0; }
    if (c.p < c.porcje.length) { pokaz(); return; }
    // Strona odsłonięta
    pokaz();
    if (c.s + 1 < c.strony.length) {
      T.odznaka(kotwica, 'Strona odsłonięta', 'premia');
      c.etap = 'przejscie';
      g.nastepny = setTimeout(() => { if (!g.aktywna) return; c.s++; c.etap = 'szukanie'; nowaStrona(); }, 1000);
    } else {
      T.odznaka(kotwica, 'Fragment odsłonięty', 'premia');
      c.etap = 'przejscie';
      g.nastepny = setTimeout(() => { if (g.aktywna) doCzytania(); }, 1100);
    }
  }

  // Ostatni etap: cały fragment bez znaczników, do przeczytania w zwykłym tempie
  function doCzytania() {
    c.etap = 'czytanie';
    scena.classList.remove('strona');
    scena.style.maxHeight = '';
    rysujElementy(0, c.elementy.length, true);
    $('j-przeczytane').hidden = false;
    g.tik = performance.now();
    pokaz();
    // Scena tak wysoka, żeby przycisk „Przeczytane” był na ekranie; dłuższy tekst przewija się w scenie
    const pod = $('j-przeczytane').parentElement.getBoundingClientRect().bottom - scena.getBoundingClientRect().bottom;
    scena.style.maxHeight = `${wysokoscNaScene(pod + 20)}px`;
    T.trybGry(true, modul);
  }

  function koniecCaly() {
    if (c.etap !== 'czytanie') return;
    const wpis = {
      kiedy: Date.now(), slowa: c.slow, czas: Math.max(1, Math.round(c.szukanie)), bledy: c.bledy, podp: c.podp,
      czytanie: Math.max(1, Math.round(c.czytanie)), rekord: false,
    };
    T.dopisz(ustawCaly().historia, wpis);
    T.zapisz();
    const tempo = Math.round(c.slow / (Math.max(1, c.czytanie) / 60));
    const dalej = c.nastepne < elementyTekstu().length;
    const w = $('j-wynik-koniec');
    w.textContent = `Fragment przeczytany: ${c.slow} ${T.odmiana(c.slow, 'słowo', 'słowa', 'słów')}. ` +
      `Szukanie: ${czasTekst(c.szukanie)}, pomyłki: ${c.bledy}, podpowiedzi: ${c.podp}. ` +
      `Czytanie całości: ${czasTekst(c.czytanie)} (ok. ${tempo} ${T.odmiana(tempo, 'słowo', 'słowa', 'słów')} na minutę).`;
    const jedenFragment = c.przesuniecie === 0 && !dalej;
    c.przesuniecie = dalej ? c.nastepne : 0;
    spoczynek();
    w.hidden = false;
    $('j-start').textContent = dalej ? 'Dalszy fragment' : jedenFragment ? 'Jeszcze raz' : 'Od początku';
    c.etykieta = $('j-start').textContent;
    T.trybGry(false, w);
    historia();
  }

  // Po fragmencie w trybie „Cały fragment” przycisk mówi, co będzie dalej (dalszy fragment albo od początku)
  function etykietaStartu() {
    const zmieniony = T.biezacyTekst().tresc !== c.zrodlo;
    $('j-start').textContent = tryb() === 'caly' && c.etykieta && !zmieniony ? c.etykieta : 'Start';
  }

  // ================= zdarzenia =================

  scena.addEventListener('click', (ev) => {
    const span = ev.target.closest('.slowo');
    if (!span || !g.aktywna) return;
    if (tryb() === 'caly') klikCaly(span);
    else klikWyscig(span);
  });
  $('j-start').addEventListener('click', start);
  $('j-przeczytane').addEventListener('click', koniecCaly);
  $('j-start-poziom').addEventListener('change', () => { if (!g.aktywna) spoczynek(); });
  $('j-zaznacz').addEventListener('change', () => { if (g.aktywna && tryb() !== 'caly') rysuj(); });
  $('j-zmien-tekst').addEventListener('click', () => T.przelacz('rsvp'));
  $('j-wybor-tekstu').addEventListener('change', (ev) => {
    if (g.aktywna) return;
    T.wybierzTekst(ev.target.value);
    $('j-wynik-koniec').hidden = true;
    etykietaStartu();
    spoczynek();
  });
  $('j-tryb').addEventListener('change', (ev) => {
    if (g.aktywna) return;
    T.stan.pojecia.tryb = ev.target.value === 'caly' ? 'caly' : 'wyscig';
    T.zapisz();
    $('j-wynik-koniec').hidden = true;
    etykietaStartu();
    spoczynek();
    historia();
  });
  $('j-fragment').addEventListener('change', (ev) => {
    if (['40', '80', '200'].includes(ev.target.value)) ustawCaly().fragment = ev.target.value;
    T.zapisz();
    c.przesuniecie = 0;
    c.etykieta = '';
    etykietaStartu();
  });
  $('j-porcja').addEventListener('change', (ev) => {
    const n = Number(ev.target.value);
    if (n >= 3 && n <= 6) ustawCaly().porcja = n;
    T.zapisz();
  });
  $('j-wyczysc').addEventListener('click', () => {
    const z = T.stan.pojecia;
    if (tryb() === 'caly') {
      if (!z.caly.historia.length) return;
      if (!confirm('Usunąć wyniki trybu „Cały fragment”?')) return;
      z.caly.historia = [];
    } else {
      if (!z.historia.length && !z.rekord) return;
      if (!confirm('Usunąć wyniki i rekord wyścigu?')) return;
      Object.assign(z, { rekord: 0, poziom: 0, historia: [] });
    }
    T.zapisz();
    pokaz();
    historia();
  });

  T.moduly.pojecia = {
    wejdz() {
      T.odswiezWyboryTekstu();
      $('j-tryb').value = tryb();
      $('j-fragment').value = ustawCaly().fragment;
      $('j-porcja').value = String(ustawCaly().porcja);
      $('j-wynik-koniec').hidden = true;
      etykietaStartu();
      spoczynek();
      historia();
    },
    wyjdz: zatrzymaj,
    przerwij() { spoczynek(); T.trybGry(false, $('j-start-blok')); },
  };
})();
