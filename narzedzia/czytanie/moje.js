/* Trener czytania — „Moje teksty”: wspólna lista własnych tekstów z przyciskiem „Dodaj tekst” i formularzem
   (dodanie, poprawa, usunięcie). Ta sama lista jest w każdym ćwiczeniu, które korzysta z własnych tekstów.
   Teksty tylko w tej przeglądarce i w kopii do pliku; nazwy i treści wyłącznie przez textContent. */
'use strict';

(() => {
  const { el } = T;
  const listy = [];   // wszystkie wstawione listy — po każdej zmianie odświeżane razem

  function przycisk(tekst, klasa) {
    const b = el('button', klasa, tekst);
    b.type = 'button';
    return b;
  }

  // Bez nazwy: pierwsze słowa tekstu; nazwa zajęta przez inny tekst dostaje numer
  function nazwaDla(wpisana, tresc, poza) {
    let nazwa = wpisana.trim().slice(0, T.MAX_NAZWY) || tresc.trim().split(/\s+/).slice(0, 5).join(' ').slice(0, T.MAX_NAZWY);
    const zajete = new Set(T.stan.tekst.moje.filter((m) => m !== poza).map((m) => m.nazwa));
    if (zajete.has(nazwa)) {
      let n = 2;
      while (zajete.has(`${nazwa} (${n})`)) n++;
      nazwa = `${nazwa} (${n})`;
    }
    return nazwa;
  }

  function poZmianie() {
    if (T.odswiezWyboryTekstu) T.odswiezWyboryTekstu();
    for (const l of listy) l.odswiez();
    for (const l of listy) if (l.opcje.poZmianie) l.opcje.poZmianie();
  }

  // opcje: prefiks (do identyfikatorów), wybrany() — id wybranego tekstu, wybierz(id), opis(m) — tekst po prawej,
  // pilne(m) — wyróżnić opis, kolejnosc(a, b) — sortowanie, poZmianie() — po dodaniu, poprawie albo usunięciu
  function lista(kontener, opcje) {
    const naglowek = el('div', 'naglowek-sekcji');
    const dodaj = przycisk('Dodaj tekst', 'przycisk maly');
    naglowek.append(el('h3', '', 'Moje teksty'), dodaj);
    const komunikat = el('p', 'komunikat');
    komunikat.id = `${opcje.prefiks}-moje-komunikat`;
    komunikat.setAttribute('role', 'status');

    const formularz = el('div', 'ramka moj-formularz');
    formularz.hidden = true;
    const tytul = el('p', 'moj-formularz-tytul');
    const etNazwa = el('label', 'pole', 'Nazwa');
    const nazwa = document.createElement('input');
    nazwa.type = 'text';
    nazwa.maxLength = T.MAX_NAZWY;
    nazwa.autocomplete = 'off';
    nazwa.placeholder = 'np. Inwokacja';
    etNazwa.append(nazwa);
    const etTresc = el('label', 'pole odstep-gora', 'Tekst');
    const tresc = document.createElement('textarea');
    tresc.maxLength = T.MAX_TEKSTU;
    tresc.spellcheck = false;
    tresc.placeholder = 'Wklej albo wpisz tekst: wiersz, rozdział, artykuł. Wersy i odstępy między zwrotkami zostaną zachowane.';
    etTresc.append(tresc);
    const akcje = el('div', 'akcje odstep-gora');
    const zapisz = przycisk('Zapisz', 'przycisk maly glowny');
    const wklej = przycisk('Wklej ze schowka', 'przycisk maly');
    const anuluj = przycisk('Anuluj', 'przycisk maly');
    const usun = przycisk('Usuń tekst', 'przycisk maly ostrozny');
    akcje.append(zapisz, wklej, anuluj, usun);
    const info = el('p', 'drobny', `Teksty zostają tylko w tej przeglądarce i trafiają do kopii w pliku. ` +
      `Do ${T.MAX_MOICH} tekstów, każdy do ${T.MAX_TEKSTU.toLocaleString('pl-PL')} znaków.`);
    const blad = el('p', 'komunikat blad');
    formularz.append(tytul, etNazwa, etTresc, akcje, blad, info);

    const ul = el('ul', 'historia moje-lista');
    kontener.replaceChildren(naglowek, komunikat, formularz, ul);

    let edytowany = null;

    function otworz(m) {
      edytowany = m || null;
      if (!m && T.stan.tekst.moje.length >= T.MAX_MOICH) {
        T.komunikat(`Masz już ${T.MAX_MOICH} tekstów — usuń któryś, żeby dodać nowy.`, true, komunikat.id);
        return;
      }
      tytul.textContent = m ? `Poprawa: ${m.nazwa}` : 'Nowy tekst';
      nazwa.value = m ? m.nazwa : '';
      tresc.value = m ? m.tresc : '';
      usun.hidden = !m;
      blad.textContent = '';
      formularz.hidden = false;
      dodaj.hidden = true;
      formularz.scrollIntoView({ block: 'nearest' });
      (m ? tresc : nazwa).focus({ preventScroll: true });
    }
    function zamknij() {
      formularz.hidden = true;
      dodaj.hidden = false;
      edytowany = null;
      tresc.value = '';
    }

    function zapiszFormularz() {
      const t = T.stan.tekst;
      const nowaTresc = tresc.value.slice(0, T.MAX_TEKSTU);
      if (!nowaTresc.trim()) { blad.textContent = 'Wklej albo wpisz tekst.'; return; }
      const nowaNazwa = nazwaDla(nazwa.value, nowaTresc, edytowany);
      if (edytowany) {
        const m = edytowany;
        const stare = { nazwa: m.nazwa, tresc: m.tresc };
        Object.assign(m, { nazwa: nowaNazwa, tresc: nowaTresc });
        if (!T.zapisz()) { Object.assign(m, stare); return; }   // brak miejsca: bez zmian
        zamknij();
        poZmianie();
        T.komunikat(`Zapisano zmiany w „${nowaNazwa}”.`, false, komunikat.id);
        return;
      }
      if (t.moje.length >= T.MAX_MOICH) { blad.textContent = `Masz już ${T.MAX_MOICH} tekstów — usuń któryś.`; return; }
      const id = `m${Date.now().toString(36)}${T.losowa(1296).toString(36)}`;
      t.moje.push({ id, nazwa: nowaNazwa, tresc: nowaTresc });
      if (!T.zapisz()) { t.moje.pop(); return; }
      zamknij();
      if (opcje.wybierz) opcje.wybierz(id);   // nowy tekst od razu wybrany w tym ćwiczeniu
      poZmianie();
      T.komunikat(`Dodano „${nowaNazwa}”.`, false, komunikat.id);
    }

    function usunTekst() {
      const m = edytowany;
      if (!m || !confirm(`Usunąć „${m.nazwa}”? Tego nie da się cofnąć (chyba że masz kopię w pliku).`)) return;
      const t = T.stan.tekst;
      t.moje = t.moje.filter((x) => x !== m);
      delete T.stan.pamiec.teksty[m.id];   // postęp nauki na pamięć tego tekstu
      if (t.wybor === m.id) t.wybor = '0';
      if (T.stan.pamiec.wybor === m.id) T.stan.pamiec.wybor = '';
      T.zapisz();
      zamknij();
      poZmianie();
      T.komunikat(`Usunięto „${m.nazwa}”.`, false, komunikat.id);
    }

    function odswiez() {
      ul.replaceChildren();
      const moje = T.stan.tekst.moje;
      if (!moje.length) {
        ul.append(el('li', 'pusto', 'Nie masz jeszcze własnych tekstów. Dodaj pierwszy — np. wiersz do nauki albo artykuł, który i tak masz przeczytać.'));
        return;
      }
      const wybrany = opcje.wybrany ? opcje.wybrany() : '';
      const kolejne = opcje.kolejnosc ? [...moje].sort(opcje.kolejnosc) : moje;
      for (const m of kolejne) {
        const li = el('li');
        if (m.id === wybrany) li.classList.add('wybrany');
        const lewa = el('span');
        const b = przycisk(m.nazwa, 'link-przycisk');
        b.dataset.id = m.id;
        b.dataset.akcja = 'wybierz';
        lewa.append(b);
        if (m.id === wybrany) lewa.append(el('span', 'znaczek', 'wybrany'));
        const prawa = el('span', 'wartosc');
        const opis = el('span', '', opcje.opis ? opcje.opis(m) : '');
        if (opcje.pilne && opcje.pilne(m)) opis.classList.add('pilne');
        const popraw = przycisk('Popraw', 'link-przycisk');
        popraw.dataset.id = m.id;
        popraw.dataset.akcja = 'popraw';
        prawa.append(opis, ' · ', popraw);
        li.append(lewa, prawa);
        ul.append(li);
      }
    }

    ul.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-akcja]');
      const m = b && T.stan.tekst.moje.find((x) => x.id === b.dataset.id);
      if (!m) return;
      if (b.dataset.akcja === 'popraw') otworz(m);
      else if (opcje.wybierz) { opcje.wybierz(m.id); odswiez(); }
    });
    dodaj.addEventListener('click', () => otworz(null));
    anuluj.addEventListener('click', zamknij);
    zapisz.addEventListener('click', zapiszFormularz);
    usun.addEventListener('click', usunTekst);
    wklej.addEventListener('click', async () => {
      try {
        const t = await navigator.clipboard.readText();
        if (!t.trim()) { blad.textContent = 'Schowek jest pusty.'; return; }
        tresc.value = t.slice(0, T.MAX_TEKSTU);
        blad.textContent = t.length > T.MAX_TEKSTU ? `Wklejono pierwsze ${T.MAX_TEKSTU.toLocaleString('pl-PL')} znaków.` : '';
      } catch (e) {
        blad.textContent = 'Przeglądarka nie dała dostępu do schowka. Przytrzymaj pole „Tekst” i wybierz „Wklej”.';
      }
    });

    const wpis = { opcje, odswiez, dodaj: () => otworz(null), zamknij };
    listy.push(wpis);
    odswiez();
    return wpis;
  }

  T.mojeTeksty = lista;
})();
