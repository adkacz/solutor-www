/* Trener czytania — na pamięć: tekst z „Moich tekstów” dzielony na kawałki (zwrotki albo 2–3 zdania),
   w kolejnych rundach znika coraz więcej słów; sprawdzanie przez wpisanie pierwszej litery ukrytego słowa
   albo recytację wersu z samooceną; po opanowaniu powtórki rozłożone w czasie.
   Ukryte słowa nie są w ogóle wstawiane na stronę. Treści tylko przez textContent. */
'use strict';

(() => {
  const { $, el } = T;
  const POZIOMY = ['przeczytaj', '¼ ukryta', 'połowa ukryta', '¾ ukryte', 'pierwsze litery', 'z pamięci'];
  const KROTKO = ['czytanie', '¼', '½', '¾', 'litery', 'z pamięci'];
  const UKRYTE = [0, 0.25, 0.5, 0.75, 1, 1];
  const ODSTEPY = [1, 3, 7, 14, 30];   // dni do kolejnej powtórki
  const PROG_POWTORKI = 0.9;           // powtórka udana: co najmniej 90% słów bez podpowiedzi
  const DZIEN = 86400000;
  const MAX_WERSOW = 8;                // dłuższa zwrotka dzielona po 4 wersy
  const SLOW_KAWALKA = 30;             // proza: zdania łączone do ok. 30 słów (najwyżej 3 zdania)
  const LACZ = 3;                      // łączenie: ostatnio opanowane kawałki, najwyżej 3 naraz

  const modul = $('m-pamiec');
  const scena = $('n-scena');
  const kotwica = scena.parentElement;
  const s = {
    aktywna: false, tryb: '', id: '', kawalki: [], zakres: [0, 1], poziom: 0, etap: '',
    slowa: [], perm: [], zle: new Set(), kolejka: [], k: 0, jednostki: [], u: 0, pokazana: false, czeka: false,
    sesja: { ukryte: 0, dobrze: 0 }, nastepny: null,
  };

  const bezZnakow = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'l').toLowerCase();
  const pierwsza = (t) => { const m = t.match(/[\p{L}\p{N}]/u); return m ? bezZnakow(m[0]) : ''; };
  const pm = () => T.stan.pamiec;
  // Przy wpisywaniu pierwszej litery poziom „pierwsze litery” nic by nie sprawdzał — jest tylko przy recytacji
  const poziomDla = (x) => (x === 4 && !pm().opcje.glosno ? 5 : x);
  const moje = () => T.stan.tekst.moje;
  const tekst = (id) => moje().find((m) => m.id === id);
  const poczatekDnia = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dzisiaj = (ts) => ts < poczatekDnia(Date.now()) + DZIEN;
  const dataTekst = (ts) => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });

  // ---------- tekst › kawałki › jednostki (wersy albo zdania) › słowa ----------
  function slowa(linia) {
    return linia.split(/\s+/).filter(Boolean).map((t) => {
      const m = t.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
      return { t, przed: m[1], rdzen: m[2], po: m[3], l: pierwsza(t) };
    });
  }
  function podziel(tresc) {
    const bloki = tresc.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
      .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
    const kawalki = [];
    for (const linie of bloki) {
      const srednio = linie.reduce((a, l) => a + l.split(/\s+/).length, 0) / linie.length;
      if (linie.length > 1 && srednio <= 12) {   // wiersz: wersy
        const ile = linie.length <= MAX_WERSOW ? linie.length : 4;
        for (let i = 0; i < linie.length; i += ile) kawalki.push({ wiersz: true, jednostki: linie.slice(i, i + ile).map(slowa) });
        continue;
      }
      const zdania = (linie.join(' ').match(/[^.!?…]*[.!?…]+["”»)]*|[^.!?…]+$/g) || []).map((z) => z.trim()).filter(Boolean);
      let biezacy = [], ile = 0;
      for (const z of zdania) {
        const sl = slowa(z);
        biezacy.push(sl);
        ile += sl.length;
        if (ile >= SLOW_KAWALKA || biezacy.length >= 3) { kawalki.push({ wiersz: false, jednostki: biezacy }); biezacy = []; ile = 0; }
      }
      if (biezacy.length) {
        const ostatni = kawalki[kawalki.length - 1];
        if (ile < 8 && ostatni && !ostatni.wiersz) ostatni.jednostki.push(...biezacy);   // krótka końcówka do poprzedniego
        else kawalki.push({ wiersz: false, jednostki: biezacy });
      }
    }
    return kawalki;
  }

  // Postęp tekstu; gdy zmieniła się liczba kawałków (tekst przerobiony), nauka zaczyna się od nowa
  function postep(id, n) {
    let p = pm().teksty[id];
    if (!p || p.kawalki !== n) {
      p = { kawalki: n, opanowane: 0, poziom: 0, laczenie: false, czyste: 0, powt: null };
      pm().teksty[id] = p;
    }
    return p;
  }
  const opisPostepu = (p, n) => {
    if (!p || (!p.opanowane && !p.poziom && !p.powt)) return 'nie zaczęty';
    if (p.powt) return dzisiaj(p.powt.nastepna) ? 'opanowany · powtórka dziś' : `opanowany · powtórka ${dataTekst(p.powt.nastepna)}`;
    return `${n > 1 ? `kawałki ${p.opanowane} z ${n}` : 'w nauce'}, poziom: ${KROTKO[poziomDla(p.poziom)]}`;
  };

  // ---------- ekran spoczynku ----------
  function wybierzDomyslny() {
    if (!tekst(pm().wybor)) pm().wybor = moje().length ? moje()[0].id : '';
    return pm().wybor;
  }

  function spoczynek() {
    s.aktywna = false;
    s.czeka = false;
    clearTimeout(s.nastepny);
    scena.style.maxHeight = '';
    scena.hidden = true;
    $('n-wpis-blok').hidden = true;
    $('n-glosno-blok').hidden = true;
    $('n-dalej').hidden = true;
    const sel = $('n-tekst');
    sel.replaceChildren(...moje().map((m) => { const o = el('option', '', m.nazwa); o.value = m.id; return o; }));
    const id = wybierzDomyslny();
    sel.value = id;
    sel.disabled = !id;
    $('n-od-nowa').hidden = !id;
    $('n-rundy').value = String(pm().opcje.rundy);
    $('n-glosno').checked = pm().opcje.glosno;
    $('n-start-blok').hidden = false;
    $('n-cel').textContent = '—';
    $('n-cel-pod').textContent = '';
    const start = $('n-start');
    const doRsvp = $('n-dodaj');
    if (!id) {
      $('n-start-tekst').textContent = 'Dodaj tekst, którego chcesz się nauczyć — np. wiersz albo rolę.';
      start.hidden = true;
      doRsvp.hidden = false;
    } else {
      const m = tekst(id);
      const kaw = podziel(m.tresc);
      const p = pm().teksty[id] && pm().teksty[id].kawalki === kaw.length ? pm().teksty[id] : null;
      start.hidden = !kaw.length;
      doRsvp.hidden = true;
      const n = kaw.length;
      const jakie = kaw.length && kaw[0].wiersz ? 'zwrotki albo grupy po 4 wersy' : 'kawałki po 2–3 zdania';
      if (!n) {
        $('n-start-tekst').textContent = 'Ten tekst jest pusty. Popraw go w „Moich tekstach” niżej.';
      } else if (p && p.powt) {
        const teraz = dzisiaj(p.powt.nastepna);
        start.textContent = teraz ? 'Powtórka' : 'Powtórz teraz';
        $('n-start-tekst').textContent = teraz
          ? 'Tekst opanowany — dziś powtórka całości z pamięci.'
          : `Tekst opanowany. Następna powtórka: ${dataTekst(p.powt.nastepna)}. Możesz powtórzyć wcześniej — termin się wtedy nie zmieni.`;
      } else {
        start.textContent = p && (p.opanowane || p.poziom) ? 'Ucz się dalej' : 'Zacznij naukę';
        $('n-start-tekst').textContent = `Tekst ma ${n} ${T.odmiana(n, 'kawałek', 'kawałki', 'kawałków')} (${jakie}). ` +
          'Każdy najpierw przeczytasz, potem słów będzie ubywać, aż powiesz go z pamięci.' +
          (p && (p.opanowane || p.poziom) ? ` Postęp: ${opisPostepu(p, n)}.` : '');
      }
    }
    pokazWskazniki();
    lista.odswiez();
  }

  // ---------- runda ----------
  function rysuj() {
    scena.replaceChildren();
    s.jednostki.forEach((j, u) => {
      if (u && j.kawalek !== s.jednostki[u - 1].kawalek) scena.append(el('span', 'zwrotka'));
      const jedn = el('span', j.wiersz ? 'jedn wers' : 'jedn zdanie');
      jedn.dataset.u = String(u);
      j.slowa.forEach((w) => {
        const span = el('span', 'n-slowo');
        span.dataset.i = String(w.i);
        rysujSlowo(span, w);
        jedn.append(span, ' ');
      });
      scena.append(jedn, j.wiersz ? '' : ' ');
    });
    scena.scrollTop = 0;
  }

  function rysujSlowo(span, w) {
    span.className = 'n-slowo';
    if (!w.ukryte || w.stan) {
      span.textContent = w.t;
      if (w.stan) span.classList.add(w.stan === 'ok' ? 'n-ok' : 'n-zle');
      return;
    }
    const luka = el('span', 'luka', s.poziom === 4 ? w.rdzen[0] : '');
    luka.style.width = s.poziom === 5 ? '2.6em' : `${Math.max(1.4, w.rdzen.length * 0.55)}em`;
    span.replaceChildren(w.przed, luka, w.po);
  }
  const spanSlowa = (w) => scena.querySelector(`[data-i="${w.i}"]`);

  function przygotujZakres() {
    s.slowa = [];
    s.jednostki = [];
    s.kawalki.slice(s.zakres[0], s.zakres[1]).forEach((k, kawalek) => {
      for (const j of k.jednostki) {
        const jedn = { kawalek, wiersz: k.wiersz, slowa: [] };
        s.jednostki.push(jedn);
        for (const w of j) {
          const x = { ...w, i: s.slowa.length, ukryte: false, stan: '' };
          s.slowa.push(x);
          jedn.slowa.push(x);
        }
      }
    });
    s.perm = T.tasuj(s.slowa.filter((w) => w.l).map((w) => w.i));
    s.zle = new Set();
  }

  // Który kawałek i poziom teraz; false — tekst opanowany
  function ustawEtap() {
    const p = postep(s.id, s.kawalki.length);
    if (p.laczenie) {
      s.etap = 'laczenie';
      s.zakres = [Math.max(0, p.opanowane - LACZ), p.opanowane];
      s.poziom = 5;
    } else if (p.opanowane < s.kawalki.length) {
      s.etap = 'kawalek';
      s.zakres = [p.opanowane, p.opanowane + 1];
      s.poziom = poziomDla(p.poziom);
    } else {
      return false;
    }
    przygotujZakres();
    return true;
  }

  function nowaRunda() {
    if (!s.aktywna) return;
    s.czeka = false;
    const n = Math.ceil(s.perm.length * UKRYTE[s.poziom]);
    const ukryj = new Set(s.poziom >= 4 ? s.perm : s.perm.slice(0, n));
    for (const i of s.zle) ukryj.add(i);   // słowa z błędem z poprzedniej rundy znów są ukryte
    for (const w of s.slowa) { w.ukryte = ukryj.has(w.i); w.stan = ''; }
    s.kolejka = s.slowa.filter((w) => w.ukryte);
    s.k = 0;
    s.u = 0;
    s.pokazana = false;
    rysuj();
    const czytanie = s.poziom === 0;
    const glosno = pm().opcje.glosno;
    $('n-dalej').hidden = !czytanie;
    $('n-wpis-blok').hidden = czytanie || glosno;
    $('n-glosno-blok').hidden = czytanie || !glosno;
    $('n-cel').textContent = czytanie ? 'Przeczytaj uważnie, najlepiej na głos'
      : glosno ? 'Powiedz podświetlony fragment' : 'Wpisz pierwszą literę';
    if (!czytanie && !s.kolejka.length) { koniecRundy(); return; }
    if (!czytanie && glosno) nastepnaJednostka(true);
    if (!czytanie && !glosno) { zaznaczBiezace(); $('n-wpis').focus({ preventScroll: true }); dopasujDoKlawiatury(); sledzKlawiature(); }
    pokazWskazniki();
  }

  function zaznaczBiezace() {
    scena.querySelectorAll('.luka.biezaca').forEach((e) => e.classList.remove('biezaca'));
    const w = s.kolejka[s.k];
    const luka = w && spanSlowa(w).querySelector('.luka');
    if (!luka) return;
    luka.classList.add('biezaca');
    przewin(luka);
  }
  function przewin(e) {
    const r = e.getBoundingClientRect(), sr = scena.getBoundingClientRect();
    if (r.top < sr.top + 8 || r.bottom > sr.bottom - 8) scena.scrollTop += r.top - sr.top - scena.clientHeight / 3;
  }

  // Klawiatura ekranowa. Strona prosi przeglądarkę, żeby zmniejszała się razem z klawiaturą (meta viewport
  // interactive-widget=resizes-content w index.html). Gdy przeglądarka tego nie umie i tylko przykrywa dół strony,
  // scena kończy się tuż nad widoczną częścią (visualViewport). Za każdym razem od zera: zdjęcie ograniczenia,
  // pomiar, ewentualnie nowe ograniczenie — wszystko w jednej klatce, bez mrugania. Bieżąca luka zawsze w widoku.
  function dopasujDoKlawiatury() {
    scena.style.maxHeight = '';
    const vv = window.visualViewport;
    if (!s.aktywna || document.activeElement !== $('n-wpis')) return;
    if (vv) {
      const dolWidoku = vv.offsetTop + vv.height;
      const r = scena.getBoundingClientRect();
      if (r.bottom > dolWidoku - 8) scena.style.maxHeight = `${Math.max(96, Math.floor(dolWidoku - r.top - 8))}px`;
    }
    const luka = scena.querySelector('.luka.biezaca');
    if (luka) przewin(luka);
  }
  // Klawiatura wysuwa się z animacją, a Chrome po jej otwarciu sam przewija stronę do pola — sygnały przychodzą
  // w różnej kolejności albo przed końcem animacji (21.11.2026: raz scena została za wysoka, dopiero ponowne
  // przywołanie klawiatury pomogło). Dlatego po stuknięciu w pole przez 1,5 s liczymy w każdej klatce,
  // a poza tym przy każdej zmianie widoku i przewinięciu strony.
  let sledzDo = 0, zaplanowane = false;
  function sledzKlawiature() {
    const bylo = sledzDo > performance.now();
    sledzDo = performance.now() + 1500;
    if (bylo) return;
    const krok = () => { dopasujDoKlawiatury(); if (performance.now() < sledzDo) requestAnimationFrame(krok); };
    requestAnimationFrame(krok);
  }
  function zaplanujDopasowanie() {
    if (zaplanowane) return;
    zaplanowane = true;
    requestAnimationFrame(() => { zaplanowane = false; dopasujDoKlawiatury(); });
  }

  function odpowiedz(litera) {
    const w = s.kolejka[s.k];
    if (!w || s.czeka) return;
    const ok = litera === w.l;
    w.stan = ok ? 'ok' : 'zle';
    if (!ok) { T.migniecie(spanSlowa(w), 'n-mig', 350); }
    rysujSlowo(spanSlowa(w), w);
    s.k++;
    if (s.k >= s.kolejka.length) koniecRundy();
    else { zaznaczBiezace(); pokazWskazniki(); }
  }

  // Recytacja: jednostka po jednostce (wers albo zdanie) z ukrytymi słowami, „Pokaż”, potem ocena
  function nastepnaJednostka(pierwsza) {
    if (!pierwsza) s.u++;
    while (s.u < s.jednostki.length && !s.jednostki[s.u].slowa.some((w) => w.ukryte)) s.u++;
    scena.querySelectorAll('.jedn.biezaca').forEach((e) => e.classList.remove('biezaca'));
    if (s.u >= s.jednostki.length) { koniecRundy(); return; }
    const jedn = scena.querySelector(`[data-u="${s.u}"]`);
    jedn.classList.add('biezaca');
    przewin(jedn);
    s.pokazana = false;
    $('n-pokaz').hidden = false;
    $('n-dobrze').hidden = true;
    $('n-zle').hidden = true;
    pokazWskazniki();
  }
  function pokazJednostke() {
    s.pokazana = true;
    for (const w of s.jednostki[s.u].slowa) {
      if (!w.ukryte) continue;
      const span = spanSlowa(w);
      span.textContent = w.t;
      span.className = 'n-slowo n-odsl';
    }
    $('n-pokaz').hidden = true;
    $('n-dobrze').hidden = false;
    $('n-zle').hidden = false;
  }
  function ocenJednostke(ok) {
    if (!s.pokazana || s.czeka) return;
    for (const w of s.jednostki[s.u].slowa) {
      if (!w.ukryte) continue;
      w.stan = ok ? 'ok' : 'zle';
      rysujSlowo(spanSlowa(w), w);
    }
    nastepnaJednostka(false);
  }

  function koniecRundy() {
    s.czeka = true;
    scena.querySelectorAll('.biezaca').forEach((e) => e.classList.remove('biezaca'));
    $('n-wpis-blok').hidden = true;
    $('n-glosno-blok').hidden = true;
    const ukryte = s.kolejka.length;
    const zle = s.kolejka.filter((w) => w.stan === 'zle');
    s.sesja.ukryte += ukryte;
    s.sesja.dobrze += ukryte - zle.length;
    pokazWskazniki();
    if (s.tryb === 'powtorka') { koniecPowtorki(); return; }
    const p = postep(s.id, s.kawalki.length);
    if (zle.length) {
      p.czyste = 0;
      s.zle = new Set(zle.map((w) => w.i));
      T.odznaka(kotwica, `Do poprawy: ${zle.length}`, 'kara');
    } else {
      s.zle = new Set();
      p.czyste++;
      if (p.czyste < pm().opcje.rundy) {
        T.odznaka(kotwica, `Czysta runda ${p.czyste} z ${pm().opcje.rundy}`);
      } else {
        p.czyste = 0;
        if (s.etap === 'laczenie') {
          p.laczenie = false;
          T.odznaka(kotwica, 'Połączone!', 'premia');
        } else if (s.poziom < 5) {
          p.poziom = poziomDla(s.poziom + 1);
          T.odznaka(kotwica, `Dalej: ${POZIOMY[p.poziom]}`);
        } else {
          p.poziom = 0;
          p.opanowane++;
          if (p.opanowane >= 2) p.laczenie = true;
          T.odznaka(kotwica, 'Kawałek opanowany!', 'premia');
        }
        T.zapisz();
        s.nastepny = setTimeout(() => {
          if (!s.aktywna) return;
          if (ustawEtap()) nowaRunda();
          else tekstOpanowany();
        }, 1500);
        return;
      }
    }
    T.zapisz();
    s.nastepny = setTimeout(nowaRunda, 1500);
  }

  function tekstOpanowany() {
    const p = postep(s.id, s.kawalki.length);
    p.powt = { idx: 0, nastepna: poczatekDnia(Date.now()) + ODSTEPY[0] * DZIEN };
    koniecSesji('Tekst opanowany! Pierwsza powtórka całości z pamięci — jutro.');
  }

  function koniecPowtorki() {
    const p = postep(s.id, s.kawalki.length);
    const proc = s.sesja.ukryte ? s.sesja.dobrze / s.sesja.ukryte : 1;
    const procTekst = `${Math.floor(proc * 100)}% słów bez podpowiedzi`;
    if (!p.powt || dzisiaj(p.powt.nastepna)) {
      const udana = proc >= PROG_POWTORKI;
      const idx = p.powt ? (udana ? Math.min(p.powt.idx + 1, ODSTEPY.length - 1) : Math.max(p.powt.idx - 1, 0)) : 0;
      p.powt = { idx, nastepna: poczatekDnia(Date.now()) + ODSTEPY[idx] * DZIEN };
      const za = ODSTEPY[idx];
      koniecSesji(`Powtórka: ${procTekst}. ${udana ? 'Udana' : 'Poniżej 90% — odstęp się skraca'}; następna za ${za} ${T.odmiana(za, 'dzień', 'dni', 'dni')} (${dataTekst(p.powt.nastepna)}).`);
    } else {
      koniecSesji(`Powtórka dodatkowa: ${procTekst}. Termin następnej bez zmian: ${dataTekst(p.powt.nastepna)}.`);
    }
  }

  // ---------- sesja ----------
  function zapiszSesje() {
    if (!s.sesja.ukryte) return false;
    T.dopisz(pm().historia, { kiedy: Date.now(), id: s.id, powtorka: s.tryb === 'powtorka', ukryte: s.sesja.ukryte, dobrze: s.sesja.dobrze, rekord: false });
    s.sesja = { ukryte: 0, dobrze: 0 };
    T.zapisz();
    return true;
  }

  function koniecSesji(tekstWyniku) {
    const { ukryte, dobrze } = s.sesja;
    zapiszSesje();
    T.zapisz();
    spoczynek();
    const w = $('n-wynik-koniec');
    const ile = ukryte ? ` Ukryte słowa: ${ukryte}, przypomniane: ${dobrze} (${Math.floor((dobrze / ukryte) * 100)}%).` : '';
    w.textContent = `${tekstWyniku}${s.tryb === 'powtorka' ? '' : ile}`;
    w.hidden = false;
    T.trybGry(false, w);
    historia();
  }

  function start() {
    const m = tekst($('n-tekst').value);
    if (!m) return;
    pm().wybor = m.id;
    s.id = m.id;
    s.kawalki = podziel(m.tresc);
    if (!s.kawalki.length) return;
    const p = postep(m.id, s.kawalki.length);
    s.sesja = { ukryte: 0, dobrze: 0 };
    s.zle = new Set();
    if (p.powt) {
      s.tryb = 'powtorka';
      s.etap = 'powtorka';
      s.zakres = [0, s.kawalki.length];
      s.poziom = 5;
      przygotujZakres();
    } else {
      s.tryb = 'nauka';
      if (!ustawEtap()) return;
    }
    T.zapisz();
    s.aktywna = true;
    $('n-wynik-koniec').hidden = true;
    $('n-start-blok').hidden = true;
    scena.hidden = false;
    T.trybGry(true, modul);
    nowaRunda();
  }

  function pokazWskazniki() {
    const n = s.kawalki.length;
    const p = s.id && pm().teksty[s.id];
    if (!s.aktywna) {
      $('n-w-kawalek').textContent = '—';
      $('n-w-kawalek-pod').textContent = '';
      $('n-w-poziom').textContent = '—';
      $('n-w-poziom-pod').textContent = '';
      $('n-w-dobrze').textContent = '—';
      $('n-w-dobrze-pod').textContent = '';
      return;
    }
    const zakres = s.zakres[1] - s.zakres[0] > 1 ? `${s.zakres[0] + 1}–${s.zakres[1]}` : String(s.zakres[0] + 1);
    $('n-w-kawalek').textContent = s.tryb === 'powtorka' ? 'całość' : `${zakres} z ${n}`;
    $('n-w-kawalek-pod').textContent = s.tryb === 'powtorka' ? 'powtórka' : s.etap === 'laczenie' ? 'łączenie kawałków' : 'kawałek';
    $('n-w-poziom').textContent = KROTKO[s.poziom];
    $('n-w-poziom-pod').textContent = s.poziom ? `${POZIOMY[s.poziom]}` : 'bez sprawdzania';
    const proc = s.sesja.ukryte ? `${Math.floor((s.sesja.dobrze / s.sesja.ukryte) * 100)}%` : '—';
    $('n-w-dobrze').textContent = proc;
    $('n-w-dobrze-pod').textContent = s.tryb === 'powtorka' || !p ? 'bez podpowiedzi' : `czyste rundy ${p.czyste}/${pm().opcje.rundy}`;
    const zostalo = s.poziom ? s.kolejka.length - (pm().opcje.glosno ? 0 : s.k) : 0;
    $('n-cel-pod').textContent = s.poziom && !pm().opcje.glosno && !s.czeka ? `zostało: ${zostalo}` : '';
  }

  function historia() {
    T.pokazHistorie($('n-historia'), pm().historia, (w) => {
      const m = tekst(w.id);
      return {
        tytul: `${Math.floor((w.dobrze / w.ukryte) * 100)}%`,
        wartosc: `${m ? m.nazwa : 'usunięty tekst'} · ${w.powtorka ? 'powtórka' : 'nauka'} · ${w.dobrze} z ${w.ukryte} słów`,
      };
    });
  }

  // Lista „Moich tekstów”: powtórki na dziś na górze, obok postęp nauki
  const czyPilne = (m) => { const p = pm().teksty[m.id]; return !!(p && p.powt && dzisiaj(p.powt.nastepna)); };
  const lista = T.mojeTeksty($('n-moje'), {
    prefiks: 'n',
    wybrany: () => pm().wybor,
    wybierz(id) {
      if (s.aktywna) return;
      pm().wybor = id;
      T.zapisz();
      $('n-wynik-koniec').hidden = true;
      spoczynek();
      $('n-start-blok').scrollIntoView({ block: 'nearest' });
    },
    opis: (m) => { const p = pm().teksty[m.id]; return opisPostepu(p, p ? p.kawalki : 0); },
    pilne: czyPilne,
    kolejnosc: (a, b) => Number(czyPilne(b)) - Number(czyPilne(a)),
    poZmianie() { if (!s.aktywna && !modul.hidden) spoczynek(); },
  });

  // ---------- zdarzenia ----------
  $('n-start').addEventListener('click', start);
  $('n-dodaj').addEventListener('click', () => lista.dodaj());
  $('n-dalej').addEventListener('click', () => {
    if (!s.aktywna || s.poziom !== 0) return;
    const p = postep(s.id, s.kawalki.length);
    p.poziom = 1;
    s.poziom = 1;
    T.zapisz();
    nowaRunda();
  });
  $('n-wpis').addEventListener('input', (ev) => {
    const v = ev.target.value;
    ev.target.value = '';
    if (!s.aktywna) return;
    const litery = [...v].filter((c) => /[\p{L}\p{N}]/u.test(c));
    // Stuknięta podpowiedź klawiatury wstawia całe słowo ze spacją — liczy się jego pierwsza litera
    const z = litery.length > 1 && /\s$/.test(v) ? litery[0] : litery[litery.length - 1];
    if (z) odpowiedz(bezZnakow(z));
  });
  scena.addEventListener('click', () => { if (s.aktywna && !pm().opcje.glosno && s.poziom) $('n-wpis').focus({ preventScroll: true }); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', zaplanujDopasowanie);
    window.visualViewport.addEventListener('scroll', zaplanujDopasowanie);
  }
  window.addEventListener('resize', zaplanujDopasowanie);
  window.addEventListener('scroll', zaplanujDopasowanie, { passive: true });
  // Stuknięcie w pole, które już ma fokus (klawiatura schowana przyciskiem wstecz), otwiera klawiaturę bez „focus”
  $('n-wpis').addEventListener('pointerdown', sledzKlawiature);
  // Po schowaniu klawiatury (blur) scena wraca do wysokości z CSS; chwila zwłoki — klawiatura chowa się z animacją
  $('n-wpis').addEventListener('focus', sledzKlawiature);
  $('n-wpis').addEventListener('blur', () => setTimeout(dopasujDoKlawiatury, 350));
  $('n-pokaz').addEventListener('click', () => { if (s.aktywna && !s.czeka) pokazJednostke(); });
  $('n-dobrze').addEventListener('click', () => ocenJednostke(true));
  $('n-zle').addEventListener('click', () => ocenJednostke(false));
  $('n-tekst').addEventListener('change', (ev) => {
    if (s.aktywna || !tekst(ev.target.value)) return;
    pm().wybor = ev.target.value;
    T.zapisz();
    $('n-wynik-koniec').hidden = true;
    spoczynek();
  });
  $('n-rundy').addEventListener('change', (ev) => {
    const n = Number(ev.target.value);
    if (n >= 1 && n <= 3) pm().opcje.rundy = n;
    T.zapisz();
  });
  $('n-glosno').addEventListener('change', (ev) => {
    pm().opcje.glosno = ev.target.checked;
    T.zapisz();
  });
  $('n-od-nowa').addEventListener('click', () => {
    const m = tekst(pm().wybor);
    if (!m || !pm().teksty[m.id]) return;
    if (!confirm(`Zacząć naukę „${m.nazwa}” od nowa? Postęp i terminy powtórek tego tekstu zostaną usunięte (historia zostaje).`)) return;
    delete pm().teksty[m.id];
    T.zapisz();
    $('n-wynik-koniec').hidden = true;
    spoczynek();
  });
  $('n-wyczysc').addEventListener('click', () => {
    if (!pm().historia.length) return;
    if (!confirm('Usunąć historię nauki na pamięć? Postęp tekstów i terminy powtórek zostaną.')) return;
    pm().historia = [];
    T.zapisz();
    historia();
  });

  T.moduly.pamiec = {
    wejdz() { $('n-wynik-koniec').hidden = true; spoczynek(); historia(); },
    wyjdz() { if (s.aktywna) zapiszSesje(); spoczynek(); },
    przerwij() {
      if (!s.sesja.ukryte) { spoczynek(); T.trybGry(false, $('n-start-blok')); return; }
      koniecSesji('Przerwane — postęp zapisany.');
    },
  };
})();
