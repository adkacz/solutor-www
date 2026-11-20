/* Trener czytania — części wspólne: losowanie, zapis wyników, historia, tryb gry, dopasowanie czcionek.
   Dane tylko w localStorage tej przeglądarki (klucz solutor.czytanie.v1). Treści użytkownika wstawiane wyłącznie
   przez textContent — nigdy jako HTML. */
'use strict';

const T = (() => {
  const KLUCZ = 'solutor.czytanie.v1';
  const MAX_HISTORII = 40;
  const MAX_TEKSTU = 20000;
  const MAX_MOICH = 20, MAX_NAZWY = 60;   // „Moje teksty”: liczba zapisanych tekstów i długość nazwy
  const WARIANTY = ['litery', 'liczby', 'slowa'];

  const $ = (id) => document.getElementById(id);
  function el(tag, klasa, tekst) {
    const e = document.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst !== undefined) e.textContent = tekst;
    return e;
  }

  // ---------- losowanie (bez przekrzywienia „modulo”) ----------
  function losowa(max) {
    if (max <= 1) return 0;
    const granica = Math.floor(0x100000000 / max) * max;
    const t = new Uint32Array(1);
    do { crypto.getRandomValues(t); } while (t[0] >= granica);
    return t[0] % max;
  }
  function tasuj(lista) {
    const k = lista.slice();
    for (let i = k.length - 1; i > 0; i--) {
      const j = losowa(i + 1);
      [k[i], k[j]] = [k[j], k[i]];
    }
    return k;
  }
  const wybierz = (lista) => lista[losowa(lista.length)];

  // ---------- formaty ----------
  const ulamek = (x, miejsc = 1) => x.toFixed(miejsc).replace('.', ',');
  const kiedyTekst = (ts) => new Date(ts).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  function odmiana(n, jeden, kilka, wiele) {
    if (n === 1) return jeden;
    const d = n % 10, s = n % 100;
    return d >= 2 && d <= 4 && (s < 12 || s > 14) ? kilka : wiele;
  }

  // ---------- stan i jego sprawdzanie ----------
  // Seria w tablicy Schultego: ustawienia, poziom, od którego zacznie się następna seria, i historia serii
  const DLUGOSCI_SERII = ['5', '10', '15', '3m', '5m'];
  // tempa: ostatnie tempa (s/pole) na każdym rozmiarze i rodzaju znaków, np. { "5_liczby": [0.82, 0.9, …] } — z nich próg osobisty
  // podpowiedzi: 'brak' | 'cwiartka' | 'pole' (najpierw ćwiartka, potem samo pole) — dotyczą obu trybów
  // tempo: jak pokazywać tempo względem progu — 'brak' | 'pasek' (nad tablicą) | 'kolor' (tło tablicy); oba tryby
  // paleta: 'delikatna' | 'wyrazna' — kolory tła tempa (niebieski/bursztyn różniące się też jasnością)
  // metronom: 'brak' | 'prog' (stuknięcie na pole w tempie progu) | 'spokojny' (wolny rytm z cichszymi podziałami)
  // rytm: odstęp głównych uderzeń spokojnego rytmu w sekundach (przyspiesza o 5%, gdy trafiasz w rytm)
  const domyslnaSeria = () => ({ tryb: 'jedna', poziom: 5, dlugosc: '10', sufit: 7, podpowiedzi: 'brak', tempo: 'brak', paleta: 'delikatna', metronom: 'brak', rytm: 1.5, historia: [], tempa: {} });
  const PODPOWIEDZI = ['brak', 'cwiartka', 'pole'];
  const METRONOMY = ['brak', 'prog', 'spokojny'];
  const TEMPA = ['brak', 'pasek', 'kolor'];
  const MAX_TEMP = 10;
  function domyslny() {
    const skaner = {};
    for (const w of WARIANTY) skaner[w] = { rekord: 0, plansze: 0, historia: [] };
    return {
      schulte: { rekordy: {}, historia: [], seria: domyslnaSeria() },
      skaner,
      rsvp: { rekord: 0, historia: [] },
      peryferyjne: { rozpietosc: 0, wynik: 0, historia: [] },
      // pojęcia: tryb „wyscig” (rekord, poziom, historia) albo „caly” — cały fragment: długość, porcja słów, historia
      pojecia: { rekord: 0, poziom: 0, historia: [], tryb: 'wyscig', caly: { fragment: '80', porcja: 4, historia: [] } },
      // podobne zestawy: rekord i najwyższy poziom osobno dla cyfr i słów, poziom startowy następnej sesji
      podobne: { rekordy: { cyfry: { wynik: 0, poziom: 0 }, slowa: { wynik: 0, poziom: 0 } }, poziom: { cyfry: 1, slowa: 1 }, historia: [] },
      // test tempa i zrozumienia: wpisy z liczbą słów, czasem czytania (s) i dobrymi odpowiedziami
      test: { historia: [] },
      // tekst: wybór ('0'–'9' wbudowany, 'wlasny' wklejony, 'm…' z „Moich tekstów”), wklejony tekst, zapisane teksty
      tekst: { wybor: '0', wlasny: '', moje: [] },
      // na pamięć: opcje, ostatnio wybrany tekst, postęp każdego z „Moich tekstów” (po id) i historia sesji
      // postęp: kawalki — ich liczba przy nauce, opanowane — ile kawałków, poziom 0–5 bieżącego, laczenie — runda
      // łącząca ostatnie kawałki, czyste — czyste rundy z rzędu, powt — { idx odstępu, nastepna: termin } po opanowaniu
      pamiec: { opcje: { rundy: 1, glosno: false }, wybor: '', teksty: {}, historia: [] },
    };
  }
  const liczba = (x, min, max) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null);
  const calk = (x, min, max) => { const v = liczba(x, min, max); return v !== null && Number.isInteger(v) ? v : null; };
  const kiedyOk = (x) => calk(x, 1.5e12, 4.1e12);
  const obiekt = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  function lista(x, czysc) {
    if (!Array.isArray(x)) return [];
    return x.slice(0, MAX_HISTORII).map((w) => (w && typeof w === 'object' ? czysc(w) : null)).filter(Boolean);
  }
  const wszystkie = (o) => (Object.values(o).every((v) => v !== null) ? o : null);

  function oczysc(o) {
    if (!o || typeof o !== 'object') return null;
    const s = domyslny();

    const sc = obiekt(o.schulte);
    for (const [k, v] of Object.entries(obiekt(sc.rekordy))) {
      if (/^(?:[3-9]|10)_(?:liczby|litery)$/.test(k) && liczba(v, 0.1, 36000) !== null) s.schulte.rekordy[k] = v;
    }
    s.schulte.historia = lista(sc.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), n: calk(w.n, 3, 10), znaki: w.znaki === 'liczby' || w.znaki === 'litery' ? w.znaki : null,
      czas: liczba(w.czas, 0.1, 36000), bledy: calk(w.bledy, 0, 1e6), rekord: w.rekord === true,
      podp: w.podp === undefined ? 0 : calk(w.podp, 0, 1e6),   // wpisy sprzed 19.11.2026 nie mają podpowiedzi
    }));
    const se = obiekt(sc.seria);
    s.schulte.seria.tryb = se.tryb === 'seria' ? 'seria' : 'jedna';
    s.schulte.seria.poziom = calk(se.poziom, 3, 10) || 5;
    s.schulte.seria.dlugosc = DLUGOSCI_SERII.includes(se.dlugosc) ? se.dlugosc : '10';
    s.schulte.seria.sufit = calk(se.sufit, 4, 10) || 7;
    s.schulte.seria.podpowiedzi = PODPOWIEDZI.includes(se.podpowiedzi) ? se.podpowiedzi : 'brak';
    // „pasek: true” z wersji z 19.11.2026 (sam pasek) przechodzi w „tempo: pasek”
    s.schulte.seria.tempo = TEMPA.includes(se.tempo) ? se.tempo : (se.pasek === true ? 'pasek' : 'brak');
    s.schulte.seria.paleta = se.paleta === 'wyrazna' ? 'wyrazna' : 'delikatna';
    s.schulte.seria.metronom = METRONOMY.includes(se.metronom) ? se.metronom : 'brak';
    s.schulte.seria.rytm = liczba(se.rytm, 0.6, 2.5) ?? 1.5;
    for (const [k, v] of Object.entries(obiekt(se.tempa))) {
      if (!/^(?:[3-9]|10)_(?:liczby|litery)$/.test(k) || !Array.isArray(v)) continue;
      const t = v.filter((x) => liczba(x, 0.05, 60) !== null).slice(-MAX_TEMP);
      if (t.length) s.schulte.seria.tempa[k] = t;
    }
    s.schulte.seria.historia = lista(se.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), plansze: calk(w.plansze, 1, 1000), od: calk(w.od, 3, 10), najwyzszy: calk(w.najwyzszy, 3, 10),
      wzgl: liczba(w.wzgl, 0.01, 100), awanse: calk(w.awanse, 0, 1000), spadki: calk(w.spadki, 0, 1000),
      znaki: w.znaki === 'liczby' || w.znaki === 'litery' ? w.znaki : null, rekord: false,
      podp: w.podp === undefined ? 0 : calk(w.podp, 0, 1e6),
      rytmiczna: w.rytmiczna === true,   // sesja w spokojnym rytmie: wzgl = trafienia w rytm / 80%
    }));

    const sk = obiekt(o.skaner);
    for (const wariant of WARIANTY) {
      const z = obiekt(sk[wariant]);
      s.skaner[wariant] = {
        rekord: calk(z.rekord, 0, 1e9) || 0,
        plansze: calk(z.plansze, 0, 1e6) || 0,
        historia: lista(z.historia, (w) => wszystkie({
          kiedy: kiedyOk(w.kiedy), wynik: calk(w.wynik, 0, 1e9), plansze: calk(w.plansze, 0, 1e6), rekord: w.rekord === true,
        })),
      };
    }

    const r = obiekt(o.rsvp);
    s.rsvp.rekord = calk(r.rekord, 0, 5000) || 0;
    s.rsvp.historia = lista(r.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), slowa: calk(w.slowa, 1, 1e6), tempo: calk(w.tempo, 1, 5000), rekord: w.rekord === true,
    }));

    const p = obiekt(o.peryferyjne);
    s.peryferyjne.rozpietosc = calk(p.rozpietosc, 0, 10000) || 0;
    s.peryferyjne.wynik = calk(p.wynik, 0, 1e9) || 0;
    s.peryferyjne.historia = lista(p.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), bodzce: w.bodzce === 'slowa' || w.bodzce === 'liczby' ? w.bodzce : null,
      rozpietosc: calk(w.rozpietosc, 0, 10000), wynik: calk(w.wynik, 0, 1e9), rekord: w.rekord === true,
    }));

    const j = obiekt(o.pojecia);
    s.pojecia.rekord = calk(j.rekord, 0, 1e9) || 0;
    s.pojecia.poziom = calk(j.poziom, 0, 4) || 0;
    s.pojecia.historia = lista(j.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), wynik: calk(w.wynik, 0, 1e9), poziom: calk(w.poziom, 1, 4), ukonczone: calk(w.ukonczone, 0, 1e6), rekord: w.rekord === true,
    }));
    s.pojecia.tryb = j.tryb === 'caly' ? 'caly' : 'wyscig';
    const jc = obiekt(j.caly);
    s.pojecia.caly.fragment = ['40', '80', '200'].includes(jc.fragment) ? jc.fragment : '80';
    s.pojecia.caly.porcja = calk(jc.porcja, 3, 6) || 4;
    s.pojecia.caly.historia = lista(jc.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), slowa: calk(w.slowa, 1, 1e5), czas: calk(w.czas, 1, 1e6), bledy: calk(w.bledy, 0, 1e6),
      podp: calk(w.podp, 0, 1e6), czytanie: calk(w.czytanie, 1, 1e6), rekord: false,
    }));

    const d = obiekt(o.podobne);
    for (const r of ['cyfry', 'slowa']) {
      const rk = obiekt(obiekt(d.rekordy)[r]);
      s.podobne.rekordy[r] = { wynik: calk(rk.wynik, 0, 1e9) || 0, poziom: calk(rk.poziom, 0, 10) || 0 };
      s.podobne.poziom[r] = calk(obiekt(d.poziom)[r], 1, 10) || 1;
    }
    s.podobne.historia = lista(d.historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), rodzaj: w.rodzaj === 'cyfry' || w.rodzaj === 'slowa' ? w.rodzaj : null,
      rundy: calk(w.rundy, 1, 1000), dobre: calk(w.dobre, 0, 1000), poziom: calk(w.poziom, 1, 10), wynik: calk(w.wynik, 0, 1e9),
      rekord: w.rekord === true,
    }));

    s.test.historia = lista(obiekt(o.test).historia, (w) => wszystkie({
      kiedy: kiedyOk(w.kiedy), tekst: calk(w.tekst, 1, 100), slowa: calk(w.slowa, 1, 1e5), czas: liczba(w.czas, 1, 36000),
      dobre: calk(w.dobre, 0, 100), pytania: calk(w.pytania, 1, 100), powtorka: w.powtorka === true, przerwa: w.przerwa === true,
      rekord: false,
    }));

    const t = obiekt(o.tekst);
    if (typeof t.wlasny === 'string') s.tekst.wlasny = t.wlasny.slice(0, MAX_TEKSTU);
    const idki = new Set();
    for (const m of Array.isArray(t.moje) ? t.moje.slice(0, MAX_MOICH) : []) {
      const x = obiekt(m);
      if (typeof x.id !== 'string' || !/^m[0-9a-z]{1,16}$/.test(x.id) || idki.has(x.id)) continue;
      if (typeof x.nazwa !== 'string' || !x.nazwa.trim() || typeof x.tresc !== 'string') continue;
      idki.add(x.id);
      s.tekst.moje.push({ id: x.id, nazwa: x.nazwa.trim().slice(0, MAX_NAZWY), tresc: x.tresc.slice(0, MAX_TEKSTU) });
    }
    if (typeof t.wybor === 'string' && (/^(?:[0-9]|wlasny)$/.test(t.wybor) || idki.has(t.wybor))) s.tekst.wybor = t.wybor;

    const pm = obiekt(o.pamiec);
    const op = obiekt(pm.opcje);
    s.pamiec.opcje = { rundy: calk(op.rundy, 1, 3) || 1, glosno: op.glosno === true };
    if (typeof pm.wybor === 'string' && idki.has(pm.wybor)) s.pamiec.wybor = pm.wybor;
    for (const [id, v] of Object.entries(obiekt(pm.teksty))) {
      if (!idki.has(id)) continue;   // postęp usuniętego tekstu nie wraca
      const x = obiekt(v);
      const pw = obiekt(x.powt);
      const e = {
        kawalki: calk(x.kawalki, 1, 10000), opanowane: calk(x.opanowane, 0, 10000), poziom: calk(x.poziom, 0, 5),
        laczenie: x.laczenie === true, czyste: calk(x.czyste, 0, 3) || 0,
        powt: x.powt ? wszystkie({ idx: calk(pw.idx, 0, 4), nastepna: kiedyOk(pw.nastepna) }) : null,
      };
      if (e.kawalki === null || e.opanowane === null || e.poziom === null || e.opanowane > e.kawalki) continue;
      s.pamiec.teksty[id] = e;
    }
    s.pamiec.historia = lista(pm.historia, (w) => {
      const e = wszystkie({
        kiedy: kiedyOk(w.kiedy), id: typeof w.id === 'string' && /^m[0-9a-z]{1,16}$/.test(w.id) ? w.id : null,
        powtorka: w.powtorka === true, ukryte: calk(w.ukryte, 1, 1e6), dobrze: calk(w.dobrze, 0, 1e6), rekord: false,
      });
      return e && e.dobrze <= e.ukryte ? e : null;
    });
    return s;
  }

  let stan = domyslny();
  function wczytaj() {
    try {
      const s = localStorage.getItem(KLUCZ);
      if (s) { const o = oczysc(JSON.parse(s)); if (o) stan = o; }
    } catch (e) { /* tryb prywatny albo uszkodzone dane — zaczynamy od zera */ }
  }
  function zapisz() {
    try {
      localStorage.setItem(KLUCZ, JSON.stringify(stan));
      return true;
    } catch (e) {
      komunikat('Nie udało się zapisać wyników w tej przeglądarce (brak miejsca albo tryb prywatny).', true);
      return false;
    }
  }
  function usunZapis() { try { localStorage.removeItem(KLUCZ); } catch (e) { /* nic */ } }
  function dopisz(historia, wpis) {
    historia.unshift(wpis);
    if (historia.length > MAX_HISTORII) historia.length = MAX_HISTORII;
  }
  function liczbaWynikow(s) {
    let n = s.schulte.historia.length + s.schulte.seria.historia.length + s.rsvp.historia.length + s.peryferyjne.historia.length + s.pojecia.historia.length + s.pojecia.caly.historia.length + s.pamiec.historia.length + s.podobne.historia.length + s.test.historia.length;
    for (const w of WARIANTY) n += s.skaner[w].historia.length;
    return n;
  }

  // ---------- historia na ekranie ----------
  function pokazHistorie(ul, wpisy, opis) {
    ul.replaceChildren();
    if (!wpisy.length) { ul.append(el('li', 'pusto', 'Jeszcze nie ma wyników.')); return; }
    for (const w of wpisy) {
      const { tytul, wartosc } = opis(w);
      const li = el('li');
      const lewa = el('span');
      lewa.append(el('strong', '', tytul), ' ', el('span', 'meta', kiedyTekst(w.kiedy)));
      if (w.rekord) lewa.append(el('span', 'znaczek', 'rekord'));
      li.append(lewa, el('span', 'wartosc', wartosc));
      ul.append(li);
    }
  }

  // ---------- komunikaty ----------
  const zegaryKomunikatow = {};
  function komunikat(tekst, blad = false, id = 'komunikat') {
    const k = $(id);
    if (!k) return;
    k.textContent = tekst;
    k.classList.toggle('blad', blad);
    clearTimeout(zegaryKomunikatow[id]);
    zegaryKomunikatow[id] = setTimeout(() => { k.textContent = ''; }, 7000);
  }
  function odznaka(kontener, tekst, rodzaj = '') {
    kontener.querySelectorAll('.odznaka').forEach((e) => e.remove());
    const o = el('div', `odznaka ${rodzaj}`.trim(), tekst);
    kontener.append(o);
    setTimeout(() => o.remove(), 1300);
  }
  function migniecie(e, klasa, ms) {
    e.classList.add(klasa);
    setTimeout(() => e.classList.remove(klasa), ms);
  }

  // ---------- tryb gry: na czas ćwiczenia chowamy wszystko poza planszą ----------
  function trybGry(wlacz, element) {
    document.body.classList.toggle('w-grze', wlacz);
    if (!element) return;
    requestAnimationFrame(() => {
      if (wlacz) window.scrollTo(0, Math.max(0, element.getBoundingClientRect().top + window.scrollY - 8));
      else element.scrollIntoView({ block: 'nearest' });
    });
  }

  // ---------- plansze: czcionka dopasowana do rozmiaru pola ----------
  // Najdłuższy napis ma zająć do 82% szerokości pola, a litera — do 55% jego wysokości
  function dopasujCzcionke(plansza) {
    const n = Number(plansza.dataset.n) || 5;
    const wzgl = Number(plansza.dataset.wzgl) || 0.6;   // szerokość najdłuższego napisu / rozmiar czcionki
    const szer = plansza.clientWidth;
    if (!szer) return;
    const odstep = n >= 8 ? 3 : 4;
    const pole = (szer - odstep * (n - 1)) / n;
    plansza.style.gap = `${odstep}px`;
    plansza.style.fontSize = `${Math.max(8, Math.floor(Math.min(pole * 0.55, (pole * 0.82) / wzgl)))}px`;
  }
  const obserwator = 'ResizeObserver' in window
    ? new ResizeObserver((wpisy) => wpisy.forEach((w) => dopasujCzcionke(w.target)))
    : null;
  if (!obserwator) window.addEventListener('resize', () => document.querySelectorAll('.plansza').forEach(dopasujCzcionke));
  function ustawPlansze(plansza, n, wartosci) {
    plansza.dataset.n = n;
    plansza.dataset.wzgl = Math.max(...[...new Set(wartosci)].map((v) => szerokosc(v, 100) / 100)).toFixed(3);
    plansza.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    plansza.style.gridTemplateRows = `repeat(${n}, 1fr)`;
    plansza.replaceChildren(...wartosci.map((v) => {
      const b = el('button', 'pole-planszy', v);
      b.type = 'button';
      b.dataset.v = v;
      return b;
    }));
    dopasujCzcionke(plansza);
    if (obserwator) obserwator.observe(plansza);
  }

  // Szerokość napisu w pikselach (do dopasowania RSVP i odstępu w widzeniu peryferyjnym)
  const miarka = document.createElement('canvas').getContext('2d');
  function szerokosc(tekst, px, waga = 700) {
    miarka.font = `${waga} ${px}px ${getComputedStyle(document.body).fontFamily}`;
    return miarka.measureText(tekst).width;
  }

  return {
    KLUCZ, MAX_TEKSTU, MAX_MOICH, MAX_NAZWY, MAX_TEMP, WARIANTY, $, el, losowa, tasuj, wybierz, ulamek, kiedyTekst, odmiana,
    domyslny, oczysc, wczytaj, zapisz, usunZapis, dopisz, liczbaWynikow,
    get stan() { return stan; },
    ustawStan(nowy) { stan = nowy; },
    pokazHistorie, komunikat, odznaka, migniecie, trybGry, ustawPlansze, szerokosc,
    moduly: {},
  };
})();
