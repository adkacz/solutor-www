/* Trener czytania — test tempa i zrozumienia (S24). Zwykłe czytanie krótkiego opowiadania ze stoperem (liczy się
   tylko czas, gdy karta jest widoczna), potem 8 pytań bez dostępu do tekstu. Wynik: tempo (słowa na minutę),
   zrozumienie (odsetek dobrych odpowiedzi) i tempo skuteczne = tempo × zrozumienie. Test powtarza się co 2–4 tygodnie
   na nowym tekście — to pomiar, nie ćwiczenie. */
'use strict';

(() => {
  const { $, el } = T;
  const modul = $('m-test');
  const DZIEN = 24 * 3600 * 1000;
  const MIN_CZAS_S = 15;          // krócej — pytamy, czy na pewno przeczytane
  const BARDZO_SZYBKO = 900;      // słów na minutę: powyżej tego wynik jest mało wiarygodny
  const NA_WYKRESIE = 12;

  const slowaTekstu = (t) => t.akapity.join(' ').match(/[\p{L}\p{N}]+/gu).length;
  const TEKSTY = T.TESTY.map((t, i) => ({ ...t, nr: i + 1, slowa: slowaTekstu(t) }));

  const z = { etap: 'wybor', tekst: null, czas: 0, od: 0, wTle: false, odpowiedzi: [], kolejnosc: [] };
  const historia = () => T.stan.test.historia;
  const czytane = (nr) => historia().filter((w) => w.tekst === nr);
  const wybrany = () => TEKSTY[Number($('t-tekst').value) - 1] || TEKSTY[0];
  const data = (ts) => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' });

  // tempo i wynik z wpisu historii (albo bieżącego testu)
  const tempo = (w) => Math.round(w.slowa / (w.czas / 60));
  const procent = (w) => Math.round((100 * w.dobre) / w.pytania);
  const skuteczne = (w) => Math.round((tempo(w) * w.dobre) / w.pytania);
  const czasTekst = (s) => { const r = Math.round(s); return r < 60 ? `${r} s` : `${Math.floor(r / 60)} min ${r % 60} s`; };

  function etap(nazwa, pod = '') {
    z.etap = nazwa;
    $('t-etap').textContent = { wybor: 'Wybierz tekst', czytanie: 'Czytanie', pytania: 'Pytania', wynik: 'Wynik' }[nazwa];
    $('t-etap-pod').textContent = pod;
    $('t-start').hidden = nazwa === 'czytanie' || nazwa === 'pytania';
    $('t-start').textContent = nazwa === 'wynik' ? 'Nowy test' : 'Zacznij czytać';
    $('t-przeczytane').hidden = nazwa !== 'czytanie';
    $('t-sprawdz').hidden = nazwa !== 'pytania';
    $('t-czytanie').hidden = nazwa !== 'czytanie';
    $('t-pytania').hidden = nazwa !== 'pytania' && nazwa !== 'wynik';
  }

  // ---------- wybór tekstu ----------
  function listaTekstow() {
    const sel = $('t-tekst');
    const poprzedni = sel.value;
    sel.replaceChildren(...TEKSTY.map((t) => {
      const c = czytane(t.nr);
      const o = el('option', '', `${t.nr}. ${t.tytul} — ${c.length ? `czytany ${data(c[0].kiedy)}` : 'nowy'}`);
      o.value = String(t.nr);
      return o;
    }));
    const nowy = TEKSTY.find((t) => !czytane(t.nr).length);
    // zostaje wybór, który jeszcze nie był czytany; inaczej pierwszy nowy tekst (po teście — następny)
    const ok = poprzedni && TEKSTY[Number(poprzedni) - 1];
    sel.value = ok && !czytane(Number(poprzedni)).length ? poprzedni : String(nowy ? nowy.nr : (ok ? poprzedni : 1));
    opisWyboru();
  }
  function opisWyboru() {
    const t = wybrany();
    const c = czytane(t.nr);
    const h = historia();
    const czesci = [];
    if (c.length) czesci.push('Ten tekst już czytano — pamiętasz treść, więc wynik będzie zawyżony i oznaczony jako powtórka.');
    else czesci.push(`${t.slowa} słów, 8 pytań, zwykle 1–3 minuty czytania.`);
    if (!TEKSTY.some((x) => !czytane(x.nr).length)) czesci.push('Wszystkie teksty są już przeczytane — nowe pojawią się w kolejnych wersjach trenera.');
    if (h.length) {
      const ost = h[0].kiedy;
      const od = new Date(ost + 14 * DZIEN), dp = new Date(ost + 28 * DZIEN);
      czesci.push(Date.now() < od.getTime()
        ? `Ostatni test: ${data(ost)}. Następny najlepiej między ${data(od)} a ${data(dp)} — wtedy widać zmianę, a nie wahania z dnia na dzień.`
        : `Ostatni test: ${data(ost)} — to dobry moment na kolejny.`);
    }
    $('t-nastepny').textContent = czesci.join(' ');
  }

  // ---------- czytanie ----------
  function start() {
    const t = wybrany();
    z.tekst = t;
    z.czas = 0;
    z.wTle = false;
    z.odpowiedzi = Array(t.pytania.length).fill(null);
    $('t-wynik-koniec').hidden = true;
    $('t-czytanie-tytul').textContent = t.tytul;
    $('t-czytanie-tresc').replaceChildren(...t.akapity.map((a) => el('p', '', a)));
    etap('czytanie', `${t.slowa} słów — czytaj jak zwykle, żeby zrozumieć`);
    T.trybGry(true, modul);
    z.od = performance.now();
  }
  const zmierzony = () => z.czas + (z.etap === 'czytanie' && !document.hidden ? (performance.now() - z.od) / 1000 : 0);

  function przeczytane() {
    if (z.etap !== 'czytanie') return;
    const czas = zmierzony();
    if (czas < MIN_CZAS_S && !confirm(`Minęło dopiero ${Math.round(czas)} s. Tekst na pewno przeczytany? Jeśli nie, kliknij „Anuluj” i czytaj dalej.`)) return;
    z.czas = czas;
    pokazPytania();
  }

  // ---------- pytania ----------
  function pokazPytania() {
    const t = z.tekst;
    z.kolejnosc = t.pytania.map((p) => T.tasuj(p.o.map((_, i) => i)));   // indeks 0 to poprawna odpowiedź
    const lista = $('t-pytania');
    lista.replaceChildren(...t.pytania.map((p, i) => {
      const blok = el('fieldset', 'pytanie');
      blok.append(el('legend', '', `${i + 1}. ${p.p}`));
      const wybory = el('div', 'wybory jedna');
      for (const j of z.kolejnosc[i]) {
        const b = el('button', 'wybor', p.o[j]);
        b.type = 'button';
        b.dataset.pytanie = String(i);
        b.dataset.odp = String(j);
        b.setAttribute('aria-pressed', 'false');
        wybory.append(b);
      }
      blok.append(wybory);
      return blok;
    }));
    etap('pytania', 'bez zaglądania do tekstu');
    odswiezPytania();
    T.trybGry(true, modul);
  }
  function odswiezPytania() {
    const ile = z.odpowiedzi.filter((x) => x !== null).length;
    $('t-etap-pod').textContent = `odpowiedzi: ${ile} z ${z.odpowiedzi.length}, bez zaglądania do tekstu`;
    $('t-sprawdz').disabled = ile < z.odpowiedzi.length;
  }
  $('t-pytania').addEventListener('click', (ev) => {
    const b = ev.target.closest('.wybor');
    if (!b || z.etap !== 'pytania') return;
    const i = Number(b.dataset.pytanie);
    z.odpowiedzi[i] = Number(b.dataset.odp);
    b.parentElement.querySelectorAll('.wybor').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    odswiezPytania();
  });

  function sprawdz() {
    if (z.etap !== 'pytania' || z.odpowiedzi.some((x) => x === null)) return;
    const t = z.tekst;
    const dobre = z.odpowiedzi.filter((x) => x === 0).length;
    $('t-pytania').querySelectorAll('.wybor').forEach((b) => {
      b.disabled = true;
      const odp = Number(b.dataset.odp);
      const wybrana = z.odpowiedzi[Number(b.dataset.pytanie)] === odp;
      if (odp === 0) b.classList.add('dobry');
      else if (wybrana) b.classList.add('zly');
    });
    const wpis = { kiedy: Date.now(), tekst: t.nr, slowa: t.slowa, czas: Math.round(z.czas * 10) / 10, dobre, pytania: t.pytania.length, powtorka: czytane(t.nr).length > 0, przerwa: z.wTle };
    const poprzednie = historia().filter((w) => !w.powtorka);
    T.dopisz(historia(), wpis);
    T.zapisz();
    pokazWynik(wpis, poprzednie[0]);
    etap('wynik', `tekst ${t.nr}: ${t.tytul}`);
    T.trybGry(false, $('t-wynik-koniec'));
    listaTekstow();
    pokazHistorie();
  }

  function pokazWynik(w, poprzedni) {
    const blok = $('t-wynik-koniec');
    const linie = [
      `Tempo ${tempo(w)} słów na minutę (${czasTekst(w.czas)}), zrozumienie ${w.dobre} z ${w.pytania} (${procent(w)}%).`,
      `Tempo skuteczne: ${skuteczne(w)} słów zrozumianych na minutę.`,
    ];
    if (poprzedni && !w.powtorka) {
      const r = skuteczne(w) - skuteczne(poprzedni);
      linie.push(`Poprzedni test (${data(poprzedni.kiedy)}): tempo skuteczne ${skuteczne(poprzedni)}, teraz o ${Math.abs(r)} ${r >= 0 ? 'więcej' : 'mniej'}. Jeden test to mała próbka — patrz na kierunek z kilku.`);
    }
    if (w.powtorka) linie.push('To powtórka tekstu: wynik jest zawyżony, bo pamiętasz treść, i nie liczy się do porównań.');
    if (tempo(w) > BARDZO_SZYBKO) linie.push('Bardzo wysokie tempo — jeśli tekst był przeglądany, a nie czytany, zrozumienie zwykle na tym traci.');
    if (w.przerwa) linie.push('W trakcie czytania karta była w tle — tego czasu nie liczono.');
    linie.push('Poniżej Twoje odpowiedzi: zielone są poprawne. Następny test najlepiej za 2–4 tygodnie, na nowym tekście.');
    blok.replaceChildren(...linie.map((l, i) => el('p', i < 2 ? 'mocny' : '', l)));
    blok.hidden = false;
  }

  // ---------- historia i wykres ----------
  function pokazHistorie() {
    const h = historia();
    T.pokazHistorie($('t-historia'), h, (w) => {
      const t = TEKSTY[w.tekst - 1];
      return {
        tytul: `${t ? t.tytul : `Tekst ${w.tekst}`}${w.powtorka ? ' (powtórka)' : ''}`,
        wartosc: `${tempo(w)} sł/min, ${w.dobre}/${w.pytania}, skuteczne ${skuteczne(w)}`,
      };
    });
    const p = h.slice(0, NA_WYKRESIE).reverse();
    $('t-wykres-blok').hidden = p.length < 2;
    if (p.length >= 2) wykres(p);
  }
  function wykres(p) {
    const svg = $('t-wykres');
    const NS = 'http://www.w3.org/2000/svg';
    const nowy = (tag, atr, tekst) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(atr)) e.setAttribute(k, String(v));
      if (tekst !== undefined) e.textContent = tekst;
      return e;
    };
    const SZER = 300, GORA = 14, WYS = 66;
    // skala z testów na nowych tekstach — powtórka (zawyżona) nie spłaszcza reszty, najwyżej sięga sufitu
    const nowe = p.filter((w) => !w.powtorka);
    const max = Math.max(...(nowe.length ? nowe : p).map(skuteczne), 1) * 1.1;
    const krok = SZER / p.length;
    const szer = Math.min(28, krok * 0.7);
    const elementy = [];
    p.forEach((w, i) => {
      const v = skuteczne(w);
      const h = (Math.min(v, max) / max) * WYS;
      const srodek = i * krok + krok / 2;
      elementy.push(nowy('rect', { class: w.powtorka ? 'slupek powtorka' : 'slupek', x: (srodek - szer / 2).toFixed(1), y: (GORA + WYS - h).toFixed(1), width: szer.toFixed(1), height: h.toFixed(1), rx: 2 }));
      elementy.push(nowy('text', { x: srodek.toFixed(1), y: (GORA + WYS - h - 3).toFixed(1), 'text-anchor': 'middle' }, String(v)));
      elementy.push(nowy('text', { x: srodek.toFixed(1), y: 96, 'text-anchor': 'middle' }, data(w.kiedy)));
    });
    svg.replaceChildren(...elementy);
    svg.setAttribute('aria-label', `Tempo skuteczne w ${p.length} testach: ${p.map((w) => `${data(w.kiedy)} ${skuteczne(w)}${w.powtorka ? ' (powtórka)' : ''}`).join(', ')}`);
  }

  // ---------- spoczynek, karta w tle ----------
  function spoczynek() {
    z.tekst = null;
    $('t-pytania').replaceChildren();
    etap('wybor');
    listaTekstow();
  }
  document.addEventListener('visibilitychange', () => {
    if (z.etap !== 'czytanie') return;
    if (document.hidden) { z.czas += (performance.now() - z.od) / 1000; z.wTle = true; }
    else z.od = performance.now();
  });

  $('t-start').addEventListener('click', () => { if (z.etap === 'wynik') { $('t-wynik-koniec').hidden = true; spoczynek(); } start(); });
  $('t-przeczytane').addEventListener('click', przeczytane);
  $('t-sprawdz').addEventListener('click', sprawdz);
  $('t-tekst').addEventListener('change', () => {
    const v = $('t-tekst').value;   // wybór użytkownika ma pierwszeństwo, także tekst już czytany
    if (z.etap === 'wynik') { $('t-wynik-koniec').hidden = true; spoczynek(); $('t-tekst').value = v; }
    opisWyboru();
  });
  $('t-wyczysc').addEventListener('click', () => {
    if (!historia().length) return;
    if (!confirm('Usunąć wyniki testów tempa i zrozumienia?')) return;
    T.stan.test = T.domyslny().test;
    T.zapisz();
    $('t-wynik-koniec').hidden = true;
    spoczynek();
    pokazHistorie();
  });

  T.moduly.test = {
    wejdz() { $('t-wynik-koniec').hidden = true; spoczynek(); pokazHistorie(); },
    wyjdz() { if (z.etap === 'czytanie' || z.etap === 'pytania') spoczynek(); },
    przerwij() { spoczynek(); T.trybGry(false, modul); },
  };
})();
