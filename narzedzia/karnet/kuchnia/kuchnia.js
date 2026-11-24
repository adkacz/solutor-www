/* Karnet dla kuchni — prototyp. Trzy telefony (klient, szefowa, telefon kuchni) w jednej przeglądarce.
   Zmyślone dane, nic nie jest wysyłane. Stan w localStorage pod kluczem KLUCZ; druga karta z tym
   samym adresem odświeża się sama (zdarzenie storage). Dane wstawiane wyłącznie jako tekst. */
'use strict';
(function () {
  var KLUCZ = 'solutor.karnet-demo.v1';
  var CENA = 25;                 // zł za obiad (ustawia kuchnia)
  var ZAMKNIECIE_MIN = 9 * 60;   // do 9:00 klient może sam odwołać dzisiejszy obiad
  var NAZWA_KUCHNI = 'Kuchnia Domowa (przykład)';
  var TELEFONY = ['klient', 'szefowa', 'kuchnia'];
  var DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  var DNI_KROTKO = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
  var ZNAKI_KODU = 'ACDEFHJKMNPRTUWXY34679';

  /* ---------- czas (z zegarem demo) ---------- */
  var zegarDemo = '';
  function dwa(n) { return (n < 10 ? '0' : '') + n; }
  function teraz() {
    var d = new Date();
    if (zegarDemo) { var p = zegarDemo.split(':'); d.setHours(+p[0], +p[1], 0, 0); }
    return d;
  }
  function iso(d) { return d.getFullYear() + '-' + dwa(d.getMonth() + 1) + '-' + dwa(d.getDate()); }
  function dzis() { return iso(teraz()); }
  function godzTeraz() { var d = teraz(); return dwa(d.getHours()) + ':' + dwa(d.getMinutes()); }
  function ladnaGodz(g) { return g.charAt(0) === '0' ? g.slice(1) : g; }
  function minutyTeraz() { var d = teraz(); return d.getHours() * 60 + d.getMinutes(); }
  function przed9() { return minutyTeraz() < ZAMKNIECIE_MIN; }
  function zData(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dodajDni(s, n) { var d = zData(s); d.setDate(d.getDate() + n); return iso(d); }
  function roboczy(s) { var w = zData(s).getDay(); return w !== 0 && w !== 6; }
  function ladnaData(s) { var p = s.split('-'); return +p[2] + '.' + p[1]; }
  function dzienIData(s) { return DNI[zData(s).getDay()] + ' ' + ladnaData(s); }
  function krotkoIData(s) { return DNI_KROTKO[zData(s).getDay()] + ' ' + ladnaData(s); }
  function robocze(od, ile, kierunek) {
    var wynik = [], d = od;
    while (wynik.length < ile) { d = dodajDni(d, kierunek); if (roboczy(d)) wynik.push(d); }
    return wynik;
  }
  function odmiana(n, jeden, kilka, wiele) {
    var a = Math.abs(n), j = a % 10, s = a % 100;
    if (a === 1) return jeden;
    if (j >= 2 && j <= 4 && (s < 12 || s > 14)) return kilka;
    return wiele;
  }
  function obiady(n) { return n + ' ' + odmiana(n, 'obiad', 'obiady', 'obiadów'); }

  /* ---------- stan ---------- */
  function nowyKod() {
    var t = new Uint32Array(6), s = '';
    window.crypto.getRandomValues(t);
    for (var i = 0; i < 6; i++) { s += ZNAKI_KODU.charAt(t[i] % ZNAKI_KODU.length); if (i === 2) s += '-'; }
    return s;
  }

  function nowyStan(zParowaniem) {
    var d = dzis();
    var wstecz = robocze(d, 8, -1);    // [wczoraj roboczy, ..., 8 dni roboczych temu]
    var s = {
      wersja: 1, licznik: 100,
      klientApka: zParowaniem ? { stan: 'zaproszenie', kod: '', klientId: null }
                              : { stan: 'polaczony', kod: 'K7M-42Q', klientId: 'k-adam' },
      klienci: [
        { id: 'k-adam', nazwa: 'Adam', kod: zParowaniem ? '' : 'K7M-42Q', apka: !zParowaniem },
        { id: 'k-ewa', nazwa: 'Ewa (biuro obok)', kod: 'R3T-9XW', apka: true },
        { id: 'k-marek', nazwa: 'Marek', kod: 'P4H-7NC', apka: true },
        { id: 'k-halina', nazwa: 'Pani Halina', kod: '', apka: false },
        { id: 'k-zosia', nazwa: 'Zosia z apteki', kod: '', apka: false }
      ],
      prosby: [], wplaty: [], nieobecnosci: [], wydania: []
    };
    var start = wstecz[7];
    if (zParowaniem) {
      s.wplaty.push({ id: 'w1', klientId: 'k-adam', typ: 'start', obiadow: 3, kwota: 0, data: start, zgl: start, godz: '08:00', stan: 'potwierdzona' });
    } else {
      s.wplaty.push({ id: 'w1', klientId: 'k-adam', typ: 'przelew', obiadow: 10, kwota: 250, data: start, zgl: start, godz: '19:30', stan: 'potwierdzona' });
      for (var i = 0; i < 7; i++) s.wydania.push({ klientId: 'k-adam', data: wstecz[i], godz: '12:0' + i, kto: 'szefowa' });
    }
    s.wplaty.push({ id: 'w2', klientId: 'k-ewa', typ: 'start', obiadow: 6, kwota: 0, data: start, zgl: start, godz: '08:00', stan: 'potwierdzona' });
    s.wplaty.push({ id: 'w3', klientId: 'k-marek', typ: 'start', obiadow: 2, kwota: 0, data: start, zgl: start, godz: '08:00', stan: 'potwierdzona' });
    s.wplaty.push({ id: 'w4', klientId: 'k-halina', typ: 'start', obiadow: 12, kwota: 0, data: start, zgl: start, godz: '08:00', stan: 'potwierdzona' });
    s.wplaty.push({ id: 'w5', klientId: 'k-zosia', typ: 'start', obiadow: 1, kwota: 0, data: start, zgl: start, godz: '08:00', stan: 'potwierdzona' });
    s.wydania.push({ klientId: 'k-zosia', data: wstecz[0], godz: '12:15', kto: 'kuchnia' });
    // Dziś rano: Ewa odwołała obiad w aplikacji i zgłosiła przelew, którego szefowa jeszcze nie potwierdziła.
    s.nieobecnosci.push({ klientId: 'k-ewa', data: d, godz: '07:05', kto: 'klient' });
    s.wplaty.push({ id: 'w6', klientId: 'k-ewa', typ: 'przelew', obiadow: 8, kwota: 200, data: d, zgl: d, godz: '07:12', stan: 'zgloszona' });
    return s;
  }

  function poprawny(o) {
    return o && o.wersja === 1 && o.klientApka && Array.isArray(o.klienci) && Array.isArray(o.prosby) &&
      Array.isArray(o.wplaty) && Array.isArray(o.nieobecnosci) && Array.isArray(o.wydania);
  }
  function wczytaj() {
    try {
      var t = localStorage.getItem(KLUCZ);
      if (t) { var o = JSON.parse(t); if (poprawny(o)) return o; }
    } catch (e) { /* brak pamięci przeglądarki: demo działa do zamknięcia karty */ }
    return nowyStan(false);
  }
  function zapisz() { try { localStorage.setItem(KLUCZ, JSON.stringify(stan)); } catch (e) { /* jw. */ } }

  var stan = wczytaj();
  var ui = { telefon: 'klient', zakladka: { szefowa: 'dzis', kuchnia: 'dzis' }, szkic: {}, blad: {} };

  function klient(id) { for (var i = 0; i < stan.klienci.length; i++) if (stan.klienci[i].id === id) return stan.klienci[i]; return null; }
  function nazwa(id) { var k = klient(id); return k ? k.nazwa : '?'; }
  function saldo(id) {
    var n = 0;
    stan.wplaty.forEach(function (w) { if (w.klientId === id && w.stan === 'potwierdzona') n += w.obiadow; });
    stan.wydania.forEach(function (w) { if (w.klientId === id) n -= 1; });
    return n;
  }
  function czeka(id) {
    var n = 0;
    stan.wplaty.forEach(function (w) { if (w.klientId === id && w.stan === 'zgloszona') n += w.obiadow; });
    return n;
  }
  function wydanie(id, d) { for (var i = 0; i < stan.wydania.length; i++) { var w = stan.wydania[i]; if (w.klientId === id && w.data === d) return w; } return null; }
  function nieobecnosc(id, d) { for (var i = 0; i < stan.nieobecnosci.length; i++) { var w = stan.nieobecnosci[i]; if (w.klientId === id && w.data === d) return w; } return null; }
  function mojId() { return stan.klientApka.stan === 'polaczony' ? stan.klientApka.klientId : null; }
  function noweId(p) { stan.licznik += 1; return p + stan.licznik; }

  /* ---------- powiadomienia i błyski ---------- */
  var nieprzeczytane = { klient: 0, szefowa: 0, kuchnia: 0 };
  var swieze = { klient: {}, szefowa: {}, kuchnia: {} };
  var czyszczenie = {};

  function szeroki() { return window.matchMedia('(min-width: 1100px)').matches; }
  function widoczny(t) { return szeroki() || ui.telefon === t; }
  function oznacz(telefony, klucz) { telefony.forEach(function (t) { swieze[t][klucz] = true; }); }
  function blysk(t, klucz) { return swieze[t][klucz] ? ' blysk' : ''; }

  function zgasDymek(d) { setTimeout(function () { d.remove(); }, 6000); }
  function dymek(t, tekst) {
    var box = document.querySelector('#tel-' + t + ' .dymki');
    var d = el('div', { klasa: 'dymek', tekst: tekst });
    box.appendChild(d);
    if (widoczny(t)) zgasDymek(d);
    else { d.setAttribute('data-czeka', '1'); nieprzeczytane[t] += 1; }
  }

  /* ---------- budowanie elementów ---------- */
  function el(tag, opcje, dzieci) {
    var e = document.createElement(tag);
    if (opcje) Object.keys(opcje).forEach(function (k) {
      var v = opcje[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'tekst') e.textContent = v;
      else if (k === 'klasa') e.className = v;
      else if (k === 'klik') e.addEventListener('click', v);
      else if (k === 'wpis') e.addEventListener('input', v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : String(v));
    });
    (dzieci || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function przycisk(tekst, klasa, akcja, wylaczony) {
    return el('button', { type: 'button', klasa: 'przycisk ' + (klasa || ''), tekst: tekst, klik: akcja, disabled: !!wylaczony });
  }
  function pole(etykieta, id, atrybuty, domyslna) {
    var a = { id: id, value: ui.szkic[id] !== undefined ? ui.szkic[id] : domyslna, wpis: function (e) { ui.szkic[id] = e.target.value; } };
    Object.keys(atrybuty).forEach(function (k) { a[k] = atrybuty[k]; });
    return el('label', { klasa: 'pole', for: id }, [etykieta, el('input', a)]);
  }
  function wybor(etykieta, id, opcje, domyslna, poZmianie) {
    var biezaca = ui.szkic[id] !== undefined ? ui.szkic[id] : domyslna;
    var s = el('select', { id: id }, opcje.map(function (o) {
      return el('option', { value: o[0], selected: o[0] === biezaca, tekst: o[1] });
    }));
    var poWyborze = function () { ui.szkic[id] = s.value; if (poZmianie) poZmianie(s.value); };
    s.addEventListener('change', poWyborze);
    s.addEventListener('input', poWyborze);
    return el('label', { klasa: 'pole', for: id }, [etykieta, s]);
  }
  function wartosc(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function komunikat(klucz) {
    var b = ui.blad[klucz];
    return el('p', { klasa: 'komunikat' + (b ? ' blad' : ''), role: 'status', tekst: b || '' });
  }
  function wiersz(klasa, imie, znak, meta, metaZla, przyciski) {
    return el('li', { klasa: klasa || null }, [
      el('div', { klasa: 'kto' }, [
        el('span', { klasa: 'imie' }, [imie, znak ? el('span', { klasa: 'znak-apki', tekst: znak }) : null]),
        meta ? el('span', { klasa: 'meta' + (metaZla ? ' zla' : ''), tekst: meta }) : null
      ]),
      przyciski && przyciski.length ? el('div', { klasa: 'przyciski' }, przyciski) : null
    ]);
  }
  function pusto(tekst) { return el('li', { klasa: 'pusto', tekst: tekst }); }

  /* ---------- akcje ---------- */
  function zmiana() { zapisz(); rysuj(); }

  function dolacz() {
    var a = stan.klientApka;
    stan.prosby = stan.prosby.filter(function (p) { return p.kod !== a.kod; });
    a.kod = nowyKod();
    a.stan = 'czeka';
    stan.prosby.push({ kod: a.kod, data: dzis(), godz: godzTeraz() });
    oznacz(['szefowa'], 'pr-' + a.kod);
    dymek('szefowa', 'Nowa prośba o połączenie, kod ' + a.kod);
    zmiana();
  }

  function polacz(kod) {
    var kogo = wartosc('pr-' + kod + '-kto') || 'nowy';
    var k;
    if (kogo === 'nowy') {
      var n = wartosc('pr-' + kod + '-nazwa').trim();
      if (!n) { ui.blad['pr-' + kod] = 'Wpisz nazwę, pod którą chcesz widzieć tego klienta.'; rysuj(); return; }
      k = { id: noweId('k'), nazwa: n.slice(0, 40), kod: kod, apka: true };
      stan.klienci.push(k);
    } else {
      k = klient(kogo);
      if (!k) return;
      k.apka = true;
      k.kod = kod;
    }
    delete ui.blad['pr-' + kod];
    stan.prosby = stan.prosby.filter(function (p) { return p.kod !== kod; });
    if (stan.klientApka.kod === kod) {
      stan.klientApka.stan = 'polaczony';
      stan.klientApka.klientId = k.id;
      oznacz(['klient'], 'licznik');
      dymek('klient', 'Kuchnia potwierdziła połączenie. Masz ' + obiady(saldo(k.id)) + '.');
    }
    oznacz(['szefowa', 'kuchnia'], 'kl-' + k.id);
    zmiana();
  }

  function odrzucProsbe(kod) {
    stan.prosby = stan.prosby.filter(function (p) { return p.kod !== kod; });
    if (stan.klientApka.kod === kod && stan.klientApka.stan === 'czeka') {
      stan.klientApka.stan = 'odrzucony';
      dymek('klient', 'Kuchnia nie potwierdziła połączenia.');
    }
    zmiana();
  }

  function zglosWplate() {
    var id = mojId();
    if (!id) return;
    var kwota = Number(wartosc('kl-kwota'));
    var data = wartosc('kl-data') || dzis();
    if (!(kwota > 0) || kwota > 5000 || Math.round(kwota) !== kwota || kwota % CENA !== 0) {
      ui.blad.klient = 'Wpisz kwotę za całe obiady po ' + CENA + ' zł, np. 250 zł.';
      rysuj(); return;
    }
    if (data > dzis()) { ui.blad.klient = 'Data przelewu nie może być z przyszłości.'; rysuj(); return; }
    delete ui.blad.klient;
    var w = { id: noweId('w'), klientId: id, typ: 'przelew', obiadow: kwota / CENA, kwota: kwota, data: data, zgl: dzis(), godz: godzTeraz(), stan: 'zgloszona' };
    stan.wplaty.push(w);
    delete ui.szkic['kl-kwota'];
    oznacz(['szefowa', 'kuchnia'], 'wpl-' + w.id);
    oznacz(['klient'], 'czeka');
    dymek('szefowa', nazwa(id) + ': wpłata ' + kwota + ' zł do potwierdzenia');
    dymek('kuchnia', nazwa(id) + ' zgłosił(a) wpłatę ' + kwota + ' zł');
    zmiana();
  }

  function rozstrzygnij(wid, ok) {
    var w = null;
    stan.wplaty.forEach(function (x) { if (x.id === wid) w = x; });
    if (!w || w.stan !== 'zgloszona') return;
    w.stan = ok ? 'potwierdzona' : 'odrzucona';
    w.rozstrzygnieta = dzis() + ' ' + godzTeraz();
    if (w.klientId === mojId()) {
      oznacz(['klient'], ok ? 'licznik' : 'odrzucona');
      dymek('klient', ok ? 'Kuchnia potwierdziła wpłatę ' + w.kwota + ' zł. Masz ' + obiady(saldo(w.klientId)) + '.'
                         : 'Kuchnia nie widzi wpłaty ' + w.kwota + ' zł. Sprawdź przelew.');
    }
    oznacz(['kuchnia'], 'wpl-' + w.id);
    zmiana();
  }

  function zapiszWplateRecznie() {
    var id = wartosc('sz-klient');
    var kwota = Number(wartosc('sz-kwota'));
    if (!klient(id)) { ui.blad.szWplata = 'Wybierz klienta.'; rysuj(); return; }
    if (!(kwota > 0) || kwota > 5000 || Math.round(kwota) !== kwota || kwota % CENA !== 0) {
      ui.blad.szWplata = 'Kwota za całe obiady po ' + CENA + ' zł, np. 250 zł.'; rysuj(); return;
    }
    delete ui.blad.szWplata;
    var w = { id: noweId('w'), klientId: id, typ: 'gotowka', obiadow: kwota / CENA, kwota: kwota, data: dzis(), zgl: dzis(), godz: godzTeraz(), stan: 'potwierdzona' };
    stan.wplaty.push(w);
    delete ui.szkic['sz-kwota'];
    oznacz(['kuchnia'], 'wpl-' + w.id);
    if (id === mojId()) { oznacz(['klient'], 'licznik'); dymek('klient', 'Kuchnia zapisała wpłatę ' + kwota + ' zł. Masz ' + obiady(saldo(id)) + '.'); }
    zmiana();
  }

  function dodajKlienta() {
    var n = wartosc('sz-nazwa').trim();
    var ile = Number(wartosc('sz-start') || 0);
    if (!n) { ui.blad.szKlient = 'Wpisz nazwę klienta.'; rysuj(); return; }
    if (Math.round(ile) !== ile || ile < -50 || ile > 200) { ui.blad.szKlient = 'Liczba obiadów: od -50 do 200.'; rysuj(); return; }
    delete ui.blad.szKlient;
    var k = { id: noweId('k'), nazwa: n.slice(0, 40), kod: '', apka: false };
    stan.klienci.push(k);
    if (ile !== 0) stan.wplaty.push({ id: noweId('w'), klientId: k.id, typ: 'start', obiadow: ile, kwota: 0, data: dzis(), zgl: dzis(), godz: godzTeraz(), stan: 'potwierdzona' });
    delete ui.szkic['sz-nazwa']; delete ui.szkic['sz-start'];
    oznacz(['szefowa', 'kuchnia'], 'kl-' + k.id);
    zmiana();
  }

  function drugi(kto) { return kto === 'szefowa' ? 'kuchnia' : 'szefowa'; }

  function wydaj(id, kto) {
    var d = dzis();
    if (wydanie(id, d)) return;
    stan.wydania.push({ klientId: id, data: d, godz: godzTeraz(), kto: kto });
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) { oznacz(['klient'], 'licznik'); dymek('klient', 'Obiad wydany. Zostało ' + obiady(saldo(id)) + '.'); }
    zmiana();
  }
  function cofnijWydanie(id, kto) {
    var d = dzis();
    stan.wydania = stan.wydania.filter(function (w) { return !(w.klientId === id && w.data === d); });
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) { oznacz(['klient'], 'licznik'); dymek('klient', 'Kuchnia cofnęła dzisiejsze wydanie obiadu.'); }
    zmiana();
  }
  function nieBedzie(id, kto) {
    var d = dzis();
    if (nieobecnosc(id, d)) return;
    stan.nieobecnosci.push({ klientId: id, data: d, godz: godzTeraz(), kto: kto });
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) { oznacz(['klient'], 'dzis'); dymek('klient', 'Kuchnia zapisała, że dziś nie odbierasz obiadu.'); }
    zmiana();
  }
  function przywroc(id, kto) {
    var d = dzis();
    stan.nieobecnosci = stan.nieobecnosci.filter(function (w) { return !(w.klientId === id && w.data === d); });
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) { oznacz(['klient'], 'dzis'); dymek('klient', 'Kuchnia zapisała, że jednak odbierasz dziś obiad.'); }
    zmiana();
  }

  function klientPrzelacz(d) {
    var id = mojId();
    if (!id) return;
    var dzisiaj = d === dzis();
    if (dzisiaj && !przed9()) { ui.blad.klientDzis = 'Po 9:00 zmiany na dziś tylko telefonicznie w kuchni.'; rysuj(); return; }
    delete ui.blad.klientDzis;
    var bylo = nieobecnosc(id, d);
    if (bylo) stan.nieobecnosci = stan.nieobecnosci.filter(function (w) { return w !== bylo; });
    else stan.nieobecnosci.push({ klientId: id, data: d, godz: godzTeraz(), kto: 'klient' });
    var kiedy = dzisiaj ? 'dziś' : 'w dniu ' + krotkoIData(d);
    var tekst = nazwa(id) + (bylo ? ' jednak odbiera obiad ' : ' nie odbiera obiadu ') + kiedy;
    oznacz(['szefowa', 'kuchnia'], (dzisiaj ? 'dz-' : 'pl-') + (dzisiaj ? id : d));
    oznacz(['klient'], 'dzien-' + d);
    dymek('szefowa', tekst);
    dymek('kuchnia', tekst);
    zmiana();
  }

  function zamknijOdrzucone() {
    var id = mojId();
    stan.wplaty.forEach(function (w) { if (w.klientId === id && w.stan === 'odrzucona') w.przeczytana = true; });
    zmiana();
  }

  /* ---------- widok klienta ---------- */
  function widokKlienta() {
    var a = stan.klientApka, t = [];
    t.push(el('h2', { tekst: NAZWA_KUCHNI }));
    if (a.stan === 'zaproszenie' || a.stan === 'odrzucony') {
      if (a.stan === 'odrzucony') t.push(el('p', { klasa: 'uwaga zla', tekst: 'Kuchnia nie potwierdziła połączenia. Zadzwoń do kuchni albo spróbuj jeszcze raz.' }));
      else t.push(el('p', { tekst: 'Kuchnia zaprasza Cię do karnetu na obiady. Po połączeniu zobaczysz tu, ile obiadów Ci zostało, zgłosisz wpłatę i odwołasz obiad, gdy Cię nie będzie.' }));
      t.push(el('p', { klasa: 'drobny', tekst: 'Kuchnia nie dostaje Twojego numeru telefonu ani nazwiska, tylko losowy kod z tego telefonu. Nazwę, pod którą Cię widzi, nadaje sama.' }));
      t.push(przycisk(a.stan === 'odrzucony' ? 'Spróbuj jeszcze raz' : 'Dołącz', 'glowny szeroki', dolacz));
      return t;
    }
    if (a.stan === 'czeka') {
      t.push(el('p', { tekst: 'Twój kod:' }));
      t.push(el('span', { klasa: 'kod duzy', tekst: a.kod }));
      t.push(el('p', { klasa: 'uwaga', tekst: 'Podaj ten kod w kuchni: SMS-em, przez telefon albo osobiście. Kuchnia porówna go z prośbą, która właśnie do niej przyszła.' }));
      t.push(el('p', { klasa: 'drobny', tekst: 'Czekamy na potwierdzenie kuchni.' }));
      return t;
    }

    var id = a.klientId, n = saldo(id), cz = czeka(id), d = dzis();
    t.push(el('div', { klasa: 'licznik' + (n <= 0 ? ' minus' : '') + blysk('klient', 'licznik') }, [
      el('div', { klasa: 'licznik-liczba', tekst: String(n) }),
      el('div', { klasa: 'licznik-pod', tekst: n < 0 ? odmiana(n, 'obiad', 'obiady', 'obiadów') + ' na minus, do dopłaty' : odmiana(n, 'obiad', 'obiady', 'obiadów') + ' do wykorzystania' })
    ]));
    if (cz > 0) t.push(el('p', { klasa: 'uwaga' + blysk('klient', 'czeka'), tekst: 'Czeka na potwierdzenie kuchni: +' + obiady(cz) + '.' }));
    var odrzucone = stan.wplaty.filter(function (w) { return w.klientId === id && w.stan === 'odrzucona' && !w.przeczytana; });
    if (odrzucone.length) {
      var w0 = odrzucone[odrzucone.length - 1];
      t.push(el('div', { klasa: 'uwaga zla' + blysk('klient', 'odrzucona') }, [
        el('p', { tekst: 'Kuchnia nie widzi wpłaty ' + w0.kwota + ' zł z ' + ladnaData(w0.data) + '. Sprawdź przelew w banku albo zadzwoń do kuchni.', klasa: 'bez-marginesu' }),
        przycisk('Rozumiem', 'maly szeroki', zamknijOdrzucone)
      ]));
    }

    // Dziś
    t.push(el('h3', { tekst: 'Dziś, ' + dzienIData(d) }));
    var wyd = wydanie(id, d), nie = nieobecnosc(id, d), stanDnia;
    if (wyd) stanDnia = el('p', { klasa: 'dzien-stan tak', tekst: 'Obiad odebrany o ' + ladnaGodz(wyd.godz) + '.' });
    else if (nie) stanDnia = el('p', { klasa: 'dzien-stan nie', tekst: 'Dziś nie odbierasz obiadu' + (nie.kto === 'klient' ? '.' : ' (zapisała kuchnia).') });
    else stanDnia = el('p', { klasa: 'dzien-stan tak', tekst: 'Odbierasz obiad.' });
    t.push(el('div', { klasa: blysk('klient', 'dzis').trim() || blysk('klient', 'dzien-' + d).trim() || null }, [stanDnia]));
    if (!wyd) {
      var otwarte = przed9();
      t.push(przycisk(nie ? 'Jednak odbieram dziś' : 'Nie odbieram dziś', (nie ? '' : 'glowny') + ' szeroki', function () { klientPrzelacz(d); }, !otwarte));
      if (otwarte) {
        var zostalo = ZAMKNIECIE_MIN - minutyTeraz();
        var ile = zostalo >= 60 ? Math.floor(zostalo / 60) + ' h ' + (zostalo % 60) + ' min' : zostalo + ' min';
        t.push(el('p', { klasa: 'drobny', tekst: 'Zmiany na dziś do 9:00 (zostało ' + ile + '). Potem kuchnia ma już policzone obiady.' }));
      } else {
        t.push(el('p', { klasa: 'drobny', tekst: 'Po 9:00 kuchnia ma już policzone obiady. Zmiany na dziś tylko telefonicznie.' }));
      }
      t.push(komunikat('klientDzis'));
    }

    // Najbliższe dni
    t.push(el('h3', { tekst: 'Najbliższe dni' }));
    var lista = el('ul', { klasa: 'lista' });
    robocze(d, 4, 1).forEach(function (dz) {
      var n2 = nieobecnosc(id, dz);
      lista.appendChild(el('li', { klasa: (n2 ? 'nieobecny' : '') + blysk('klient', 'dzien-' + dz) || null }, [
        el('div', { klasa: 'kto' }, [
          el('span', { klasa: 'imie', tekst: krotkoIData(dz) }),
          el('span', { klasa: 'dzien-stan ' + (n2 ? 'nie' : ''), tekst: n2 ? 'nie odbieram' : 'odbieram' })
        ]),
        el('div', { klasa: 'przyciski' }, [przycisk(n2 ? 'Odbieram' : 'Nie odbieram', 'maly', function () { klientPrzelacz(dz); })])
      ]));
    });
    t.push(lista);
    t.push(el('p', { klasa: 'drobny', tekst: 'Urlop albo wyjazd zaznaczysz z wyprzedzeniem. Kuchnia widzi to od razu.' }));

    // Wpłata
    t.push(el('h3', { tekst: 'Zrobiłem przelew' }));
    t.push(el('div', { klasa: 'pola' }, [
      pole('Kwota (zł)', 'kl-kwota', { type: 'number', min: CENA, max: 5000, step: CENA, inputmode: 'numeric' }, '250'),
      pole('Data przelewu', 'kl-data', { type: 'date', max: d }, d)
    ]));
    t.push(el('p', { klasa: 'drobny', tekst: 'Obiad kosztuje ' + CENA + ' zł, więc 250 zł to 10 obiadów. Kuchnia sprawdzi przelew i potwierdzi.' }));
    t.push(przycisk('Zgłoś wpłatę', 'glowny szeroki', zglosWplate));
    t.push(komunikat('klient'));

    // Historia
    t.push(el('h3', { tekst: 'Historia' }));
    var h = [];
    stan.wplaty.forEach(function (w) {
      if (w.klientId !== id) return;
      var opis = w.typ === 'start' ? 'Stan z zeszytu: ' + obiady(w.obiadow)
        : 'Wpłata ' + w.kwota + ' zł' + (w.stan === 'zgloszona' ? ', czeka' : w.stan === 'odrzucona' ? ', niepotwierdzona' : ', +' + obiady(w.obiadow));
      h.push({ k: w.zgl + ' ' + w.godz, opis: opis, kiedy: ladnaData(w.zgl) + ' ' + ladnaGodz(w.godz), zla: w.stan === 'odrzucona' });
    });
    stan.wydania.forEach(function (w) { if (w.klientId === id) h.push({ k: w.data + ' ' + w.godz, opis: 'Obiad odebrany', kiedy: ladnaData(w.data) + ' ' + ladnaGodz(w.godz) }); });
    stan.nieobecnosci.forEach(function (w) { if (w.klientId === id && w.data <= d) h.push({ k: w.data + ' ' + w.godz, opis: 'Nie odbierałem obiadu', kiedy: ladnaData(w.data) }); });
    h.sort(function (x, y) { return x.k < y.k ? 1 : x.k > y.k ? -1 : 0; });
    var hl = el('ul', { klasa: 'lista' });
    h.slice(0, 8).forEach(function (x) { hl.appendChild(wiersz(null, x.opis, null, x.kiedy, x.zla)); });
    if (!h.length) hl.appendChild(pusto('Jeszcze nic.'));
    t.push(hl);
    t.push(el('p', { klasa: 'drobny' }, ['Twój kod w tej kuchni: ', el('span', { klasa: 'kod', tekst: a.kod }), '. Kuchnia widzi Cię pod nazwą, którą sama nadała.']));
    return t;
  }

  /* ---------- widok kuchni (szefowa i telefon kuchni) ---------- */
  function zakladki(kto) {
    var szef = kto === 'szefowa';
    var oczek = stan.wplaty.filter(function (w) { return w.stan === 'zgloszona'; }).length;
    var prosb = szef ? stan.prosby.length : 0;
    var opcje = [['dzis', 'Dziś', 0], ['wplaty', 'Wpłaty', oczek], ['klienci', 'Klienci', prosb]];
    return el('div', { klasa: 'zakladki', role: 'tablist' }, opcje.map(function (o) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': ui.zakladka[kto] === o[0] ? 'true' : 'false', tekst: o[1],
        klik: function () { ui.zakladka[kto] = o[0]; rysuj(); } });
      if (o[2]) b.appendChild(el('span', { klasa: 'znaczek', tekst: String(o[2]) }));
      return b;
    }));
  }

  function widokDzis(kto) {
    var t = [], d = dzis();
    t.push(el('h2', { tekst: 'Wydawka: ' + dzienIData(d) }));
    var doWyd = [], wydane = [], nieb = [];
    stan.klienci.forEach(function (k) {
      var w = wydanie(k.id, d), n = nieobecnosc(k.id, d);
      if (w) wydane.push({ k: k, w: w }); else if (n) nieb.push({ k: k, n: n }); else doWyd.push({ k: k });
    });
    var po = function (x, y) { return x.k.nazwa.localeCompare(y.k.nazwa, 'pl'); };
    doWyd.sort(po); wydane.sort(po); nieb.sort(po);
    var gotowac = doWyd.length + wydane.length;
    t.push(el('div', { klasa: 'liczby' }, [
      el('div', null, [el('b', { tekst: String(doWyd.length) }), el('span', { tekst: 'do wydania' })]),
      el('div', null, [el('b', { tekst: String(wydane.length) }), el('span', { tekst: 'wydano' })]),
      el('div', null, [el('b', { tekst: String(nieb.length) }), el('span', { tekst: 'nie będzie' })])
    ]));
    t.push(przed9()
      ? el('p', { klasa: 'uwaga', tekst: 'Do 9:00 klienci mogą jeszcze odwołać obiad. Na teraz: ' + obiady(gotowac) + '.' })
      : el('p', { klasa: 'uwaga ok', tekst: 'Lista zamknięta o 9:00. Gotować: ' + obiady(gotowac) + '.' }));

    var ul = el('ul', { klasa: 'lista' });
    doWyd.forEach(function (x) {
      var s = saldo(x.k.id), po2 = s - 1;
      ul.appendChild(wiersz(blysk(kto, 'dz-' + x.k.id).trim() || null, x.k.nazwa, x.k.apka ? null : 'bez aplikacji',
        'zostało ' + s + (po2 < 0 ? ', po wydaniu ' + po2 : ''), po2 < 0, [
          przycisk('Nie będzie', 'maly', function () { nieBedzie(x.k.id, kto); }),
          przycisk('Wydano', 'wydaj', function () { wydaj(x.k.id, kto); })
        ]));
    });
    wydane.forEach(function (x) {
      var s = saldo(x.k.id);
      ul.appendChild(wiersz('wydany' + blysk(kto, 'dz-' + x.k.id), x.k.nazwa, x.k.apka ? null : 'bez aplikacji',
        'wydano ' + ladnaGodz(x.w.godz) + (x.w.kto !== kto ? (x.w.kto === 'kuchnia' ? ' (telefon kuchni)' : ' (szefowa)') : '') + ', zostało ' + s, s < 0, [
          przycisk('Cofnij', 'maly', function () { cofnijWydanie(x.k.id, kto); })
        ]));
    });
    nieb.forEach(function (x) {
      var skad = x.n.kto === 'klient' ? 'w aplikacji' : x.n.kto === 'kuchnia' ? 'telefon kuchni' : 'szefowa';
      ul.appendChild(wiersz('nieobecny' + blysk(kto, 'dz-' + x.k.id), x.k.nazwa, x.k.apka ? null : 'bez aplikacji',
        'odwołane ' + ladnaGodz(x.n.godz) + ' (' + skad + ')', false, [
          przycisk('Przywróć', 'maly', function () { przywroc(x.k.id, kto); })
        ]));
    });
    if (!stan.klienci.length) ul.appendChild(pusto('Brak klientów.'));
    t.push(ul);

    t.push(el('h3', { tekst: 'Najbliższe dni' }));
    var pl = el('ul', { klasa: 'lista' });
    robocze(d, 4, 1).forEach(function (dz) {
      var nieMa = stan.klienci.filter(function (k) { return nieobecnosc(k.id, dz); }).map(function (k) { return k.nazwa; });
      pl.appendChild(wiersz(blysk(kto, 'pl-' + dz).trim() || null, krotkoIData(dz) + ': ' + obiady(stan.klienci.length - nieMa.length), null,
        nieMa.length ? 'nie będzie: ' + nieMa.join(', ') : 'wszyscy', false));
    });
    t.push(pl);
    return t;
  }

  function widokWplat(kto) {
    var szef = kto === 'szefowa', t = [];
    t.push(el('h2', { tekst: 'Wpłaty' }));
    var oczek = stan.wplaty.filter(function (w) { return w.stan === 'zgloszona'; }).slice().reverse();
    t.push(el('h3', { tekst: 'Do potwierdzenia (' + oczek.length + ')' }));
    var ul = el('ul', { klasa: 'lista' });
    oczek.forEach(function (w) {
      ul.appendChild(wiersz(blysk(kto, 'wpl-' + w.id).trim() || null, nazwa(w.klientId), null,
        w.kwota + ' zł = ' + obiady(w.obiadow) + ', przelew z ' + ladnaData(w.data) + ', zgłoszone ' + ladnaGodz(w.godz), false,
        szef ? [przycisk('Nie widzę', 'maly ostrozny', function () { rozstrzygnij(w.id, false); }),
                przycisk('Potwierdź', 'maly glowny', function () { rozstrzygnij(w.id, true); })] : null));
    });
    if (!oczek.length) ul.appendChild(pusto('Nic nie czeka.'));
    t.push(ul);
    t.push(el('p', { klasa: 'drobny', tekst: szef
      ? 'Sprawdź przelew w aplikacji banku i potwierdź. Klient od razu zobaczy nowy stan.'
      : 'Wpłaty potwierdza szefowa. Tutaj tylko podgląd.' }));

    if (szef) {
      t.push(el('h3', { tekst: 'Zapisz wpłatę (gotówka, klient bez aplikacji)' }));
      var opcje = stan.klienci.slice().sort(function (x, y) { return x.nazwa.localeCompare(y.nazwa, 'pl'); })
        .map(function (k) { return [k.id, k.nazwa]; });
      t.push(el('div', { klasa: 'pola' }, [
        wybor('Klient', 'sz-klient', opcje, opcje.length ? opcje[0][0] : ''),
        pole('Kwota (zł)', 'sz-kwota', { type: 'number', min: CENA, max: 5000, step: CENA, inputmode: 'numeric' }, '250')
      ]));
      t.push(przycisk('Zapisz wpłatę', 'glowny szeroki', zapiszWplateRecznie));
      t.push(komunikat('szWplata'));
    }

    t.push(el('h3', { tekst: 'Ostatnie' }));
    var ost = stan.wplaty.filter(function (w) { return w.typ !== 'start' && w.stan !== 'zgloszona'; })
      .sort(function (x, y) { var a = x.zgl + x.godz, b = y.zgl + y.godz; return a < b ? 1 : a > b ? -1 : 0; }).slice(0, 6);
    var ul2 = el('ul', { klasa: 'lista' });
    ost.forEach(function (w) {
      ul2.appendChild(wiersz(blysk(kto, 'wpl-' + w.id).trim() || null, nazwa(w.klientId), null,
        w.kwota + ' zł, ' + ladnaData(w.data) + (w.typ === 'gotowka' ? ', zapisała kuchnia' : '') + (w.stan === 'odrzucona' ? ', niepotwierdzona' : ', potwierdzona'), w.stan === 'odrzucona'));
    });
    if (!ost.length) ul2.appendChild(pusto('Jeszcze nic.'));
    t.push(ul2);
    return t;
  }

  function widokKlientow(kto) {
    var szef = kto === 'szefowa', t = [];
    t.push(el('h2', { tekst: 'Klienci' }));
    if (szef && stan.prosby.length) {
      t.push(el('h3', { tekst: 'Prośby o połączenie (' + stan.prosby.length + ')' }));
      var ul0 = el('ul', { klasa: 'lista' });
      stan.prosby.forEach(function (p) {
        var bezApki = stan.klienci.filter(function (k) { return !k.apka; })
          .map(function (k) { return [k.id, 'To jest: ' + k.nazwa]; });
        var opcje = [['nowy', 'Nowy klient']].concat(bezApki);
        var idNazwy = 'pr-' + p.kod + '-nazwa';
        var poleNazwy = pole('Jak go nazwać (widzisz tylko Ty)', idNazwy, { type: 'text', maxlength: 40, autocomplete: 'off', placeholder: 'np. Adam' }, '');
        var kto2 = ui.szkic['pr-' + p.kod + '-kto'] || 'nowy';
        if (kto2 !== 'nowy') poleNazwy.hidden = true;
        ul0.appendChild(el('li', { klasa: 'formularz' + blysk(kto, 'pr-' + p.kod) }, [
          el('div', { klasa: 'kto pelny' }, [
            el('span', { klasa: 'imie' }, ['Kod ', el('span', { klasa: 'kod', tekst: p.kod })]),
            el('span', { klasa: 'meta', tekst: 'przyszła ' + ladnaData(p.data) + ' ' + ladnaGodz(p.godz) + '. Porównaj z kodem, który klient podał SMS-em albo osobiście.' })
          ]),
          el('div', { klasa: 'pola pelny' }, [
            wybor('Kto to?', 'pr-' + p.kod + '-kto', opcje, 'nowy', function (v) { poleNazwy.hidden = v !== 'nowy'; }),
            poleNazwy
          ]),
          el('div', { klasa: 'przyciski pelny na-prawo' }, [
            przycisk('Odrzuć', 'maly ostrozny', function () { odrzucProsbe(p.kod); }),
            przycisk('Połącz', 'maly glowny', function () { polacz(p.kod); })
          ]),
          ui.blad['pr-' + p.kod] ? el('p', { klasa: 'komunikat blad pelny', tekst: ui.blad['pr-' + p.kod] }) : null
        ]));
      });
      t.push(ul0);
    }

    t.push(el('h3', { tekst: 'Wszyscy (' + stan.klienci.length + ')' }));
    var ul = el('ul', { klasa: 'lista' });
    stan.klienci.slice().sort(function (x, y) { return x.nazwa.localeCompare(y.nazwa, 'pl'); }).forEach(function (k) {
      var s = saldo(k.id), c = czeka(k.id);
      ul.appendChild(wiersz(blysk(kto, 'kl-' + k.id).trim() || null, k.nazwa, k.apka ? 'aplikacja' : 'bez aplikacji',
        (s < 0 ? 'na minus: ' + s : 'zostało ' + obiady(s)) + (c ? ', czeka +' + c : ''), s <= 0));
    });
    t.push(ul);

    if (szef) {
      t.push(el('h3', { tekst: 'Dodaj klienta bez aplikacji' }));
      t.push(el('div', { klasa: 'pola' }, [
        pole('Nazwa', 'sz-nazwa', { type: 'text', maxlength: 40, autocomplete: 'off', placeholder: 'np. Pan Józef' }, ''),
        pole('Ile obiadów ma teraz', 'sz-start', { type: 'number', min: -50, max: 200, step: 1, inputmode: 'numeric' }, '0')
      ]));
      t.push(przycisk('Dodaj klienta', 'szeroki', dodajKlienta));
      t.push(komunikat('szKlient'));
      t.push(el('p', { klasa: 'drobny', tekst: 'Klient z aplikacją sam zgłasza wpłaty i odwołuje obiady. Klienta bez aplikacji prowadzisz Ty, jak w zeszycie.' }));
    } else {
      t.push(el('p', { klasa: 'drobny', tekst: 'Klientów dodaje i łączy szefowa.' }));
    }
    return t;
  }

  function widokKuchni(kto) {
    var t = [zakladki(kto)];
    if (kto === 'kuchnia') t.push(el('p', { klasa: 'drobny nad', tekst: 'To samo co u szefowej. Kucharki wydają obiady i zapisują telefoniczne odwołania; wpłaty i klientów prowadzi szefowa.' }));
    var z = ui.zakladka[kto];
    return t.concat(z === 'wplaty' ? widokWplat(kto) : z === 'klienci' ? widokKlientow(kto) : widokDzis(kto));
  }

  /* ---------- rysowanie ---------- */
  function rysujPrzelacznik() {
    document.querySelectorAll('.przelacznik button').forEach(function (b) {
      var t = b.getAttribute('data-telefon');
      b.setAttribute('aria-selected', ui.telefon === t ? 'true' : 'false');
      var z = b.querySelector('.znaczek');
      z.hidden = !nieprzeczytane[t];
      z.textContent = String(nieprzeczytane[t]);
    });
    TELEFONY.forEach(function (t) { document.getElementById('tel-' + t).classList.toggle('widoczny', ui.telefon === t); });
  }

  function rysujZegary() {
    var g = ladnaGodz(godzTeraz());
    document.querySelectorAll('.telefon .godz').forEach(function (s) { s.textContent = g; });
  }

  function rysuj() {
    document.querySelector('#tel-klient .tresc').replaceChildren.apply(document.querySelector('#tel-klient .tresc'), widokKlienta());
    ['szefowa', 'kuchnia'].forEach(function (t) {
      var c = document.querySelector('#tel-' + t + ' .tresc');
      c.replaceChildren.apply(c, widokKuchni(t));
    });
    rysujPrzelacznik();
    rysujZegary();
    TELEFONY.forEach(function (t) {
      if (!widoczny(t) || czyszczenie[t] || !Object.keys(swieze[t]).length) return;
      czyszczenie[t] = setTimeout(function () { swieze[t] = {}; czyszczenie[t] = null; }, 3500);
    });
  }

  function pokazTelefon(t) {
    ui.telefon = t;
    nieprzeczytane[t] = 0;
    document.querySelectorAll('#tel-' + t + ' .dymek[data-czeka]').forEach(function (d) { d.removeAttribute('data-czeka'); zgasDymek(d); });
    rysuj();
    window.scrollTo(0, 0);
  }

  function odNowa(zParowaniem) {
    stan = nowyStan(zParowaniem);
    ui.szkic = {}; ui.blad = {};
    ui.zakladka = { szefowa: 'dzis', kuchnia: 'dzis' };
    nieprzeczytane = { klient: 0, szefowa: 0, kuchnia: 0 };
    swieze = { klient: {}, szefowa: {}, kuchnia: {} };
    document.querySelectorAll('.dymek').forEach(function (d) { d.remove(); });
    zapisz();
    rysuj();
  }

  /* ---------- start ---------- */
  document.querySelectorAll('.przelacznik button').forEach(function (b) {
    b.addEventListener('click', function () { pokazTelefon(b.getAttribute('data-telefon')); });
  });
  document.getElementById('zegar').addEventListener('change', function (e) { zegarDemo = e.target.value; rysuj(); });
  document.getElementById('od-nowa').addEventListener('click', function () { odNowa(false); });
  document.getElementById('od-nowa-parowanie').addEventListener('click', function () { odNowa(true); });
  // Po poszerzeniu okna wszystkie telefony są widoczne: dymki czekające na ukrytym telefonie mogą już zgasnąć.
  window.matchMedia('(min-width: 1100px)').addEventListener('change', function () {
    TELEFONY.forEach(function (t) {
      if (!widoczny(t)) return;
      nieprzeczytane[t] = 0;
      document.querySelectorAll('#tel-' + t + ' .dymek[data-czeka]').forEach(function (d) { d.removeAttribute('data-czeka'); zgasDymek(d); });
    });
    rysuj();
  });
  window.addEventListener('storage', function (e) { if (e.key === KLUCZ) { stan = wczytaj(); rysuj(); } });

  // Zegar „jak teraz”: co pół minuty godzina w telefonach, a o 9:00 pełne przerysowanie (zamknięcie listy).
  var bylPrzed9 = przed9();
  setInterval(function () {
    rysujZegary();
    if (przed9() !== bylPrzed9) {
      bylPrzed9 = przed9();
      var a = document.activeElement;
      if (!a || !a.closest || !a.closest('.telefony') || a.tagName === 'BUTTON') rysuj();
    }
  }, 30000);

  rysuj();
})();
