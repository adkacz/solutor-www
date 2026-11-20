/* Trener czytania — przełączanie ćwiczeń, kopia wyników w pliku, start */
'use strict';

(() => {
  const { $ } = T;
  // nazwa w adresie (#rsvp) › sekcja i moduł
  const CWICZENIA = {
    schulte: ['m-schulte', 'schulte'],
    litery: ['m-skaner', 'skaner'],
    liczby: ['m-skaner', 'skaner'],
    slowa: ['m-skaner', 'skaner'],
    rsvp: ['m-rsvp', 'rsvp'],
    peryferyjne: ['m-peryferyjne', 'peryferyjne'],
    pojecia: ['m-pojecia', 'pojecia'],
    pamiec: ['m-pamiec', 'pamiec'],
    podobne: ['m-podobne', 'podobne'],
    test: ['m-test', 'test'],
  };
  const SEKCJE = [...new Set(Object.values(CWICZENIA).map((c) => c[0]))];
  let biezace = null;
  const modul = () => (biezace ? T.moduly[CWICZENIA[biezace][1]] : null);

  function przelacz(nazwa) {
    if (!CWICZENIA[nazwa]) nazwa = 'schulte';
    if (modul()) modul().wyjdz();
    T.trybGry(false);
    for (const id of SEKCJE) $(id).hidden = id !== CWICZENIA[nazwa][0];
    document.querySelectorAll('.zakladki button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modul === nazwa)));
    biezace = nazwa;
    modul().wejdz(nazwa);
    if (location.hash !== `#${nazwa}`) {
      try { history.replaceState(null, '', `#${nazwa}`); } catch (e) { /* np. podgląd z pliku */ }
    }
  }
  T.przelacz = przelacz;

  document.querySelector('.zakladki').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-modul]');
    if (b) przelacz(b.dataset.modul);
  });
  window.addEventListener('hashchange', () => {
    const nazwa = location.hash.slice(1);
    if (nazwa !== biezace) przelacz(nazwa);
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-przerwij]');
    if (b && modul() && modul().przerwij) modul().przerwij();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && modul() && modul().wTle) modul().wTle();
  });

  // ---------- kopia w pliku ----------
  const opisWynikow = (s) => {
    const n = T.liczbaWynikow(s);
    const m = s.tekst.moje.length;
    const teksty = [m ? `${m} ${T.odmiana(m, 'zapisany tekst', 'zapisane teksty', 'zapisanych tekstów')}` : '', s.tekst.wlasny ? 'wklejony tekst' : ''].filter(Boolean);
    return [`${n} ${T.odmiana(n, 'wynik', 'wyniki', 'wyników')}`, ...teksty].join(', ').replace(/, ([^,]*)$/, ' i $1');
  };
  const dzis = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  $('zapisz-plik').addEventListener('click', () => {
    const dane = JSON.stringify({ aplikacja: 'solutor-czytanie', v: 1, zapisano: new Date().toISOString(), ...T.stan }, null, 1);
    const url = URL.createObjectURL(new Blob([dane], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `trener-czytania-${dzis()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    T.komunikat('Kopia zapisana w pobranych plikach.');
  });
  $('wczytaj-plik').addEventListener('click', () => $('plik').click());
  $('plik').addEventListener('change', (ev) => {
    const plik = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!plik) return;
    if (plik.size > 2 * 1024 * 1024) { T.komunikat('To nie jest kopia wyników trenera (plik za duży).', true); return; }
    const czytnik = new FileReader();
    czytnik.onload = () => {
      let o;
      try { o = JSON.parse(czytnik.result); } catch (e) { o = null; }
      const nowy = o && o.aplikacja === 'solutor-czytanie' ? T.oczysc(o) : null;
      if (!nowy) { T.komunikat('Nie udało się odczytać pliku: to nie jest kopia wyników trenera.', true); return; }
      const obecne = T.liczbaWynikow(T.stan) || T.stan.tekst.wlasny || T.stan.tekst.moje.length;
      if (obecne && !confirm(`Zastąpić dane w tej przeglądarce (${opisWynikow(T.stan)}) danymi z pliku (${opisWynikow(nowy)})?`)) return;
      T.ustawStan(nowy);
      T.zapisz();
      przelacz(biezace);
      T.komunikat(`Wczytano: ${opisWynikow(nowy)}.`);
    };
    czytnik.readAsText(plik);
  });
  $('wyczysc-wszystko').addEventListener('click', () => {
    if (!T.liczbaWynikow(T.stan) && !T.stan.tekst.wlasny && !T.stan.tekst.moje.length) { T.usunZapis(); T.komunikat('Nie ma żadnych zapisanych danych.'); return; }
    if (!confirm(`Usunąć z tej przeglądarki wszystkie dane trenera (${opisWynikow(T.stan)})? Tego nie da się cofnąć — jeśli chcesz, najpierw zapisz kopię do pliku.`)) return;
    T.ustawStan(T.domyslny());
    T.usunZapis();
    przelacz(biezace);
    T.komunikat('Dane usunięte.');
  });

  // ---------- start ----------
  T.wczytaj();
  przelacz(location.hash.slice(1));
})();
