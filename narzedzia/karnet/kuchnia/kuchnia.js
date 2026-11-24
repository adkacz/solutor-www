/* Karnet dla kuchni — prototyp. Trzy telefony (klient, szefowa, telefon kuchni) w jednej przeglądarce.
   Zmyślone dane, nic nie jest wysyłane. Stan w localStorage pod kluczem KLUCZ; druga karta z tym
   samym adresem odświeża się sama (zdarzenie storage). Dane wstawiane wyłącznie jako tekst.

   Zasady (z rozmowy z właścicielem, 24–25.11.2026):
   - karnet w złotówkach: wpłata zwiększa saldo, każdy dzień zmniejsza je o cenę zamówienia;
   - cena = grupa klienta (ustawia szefowa) × zupa / drugie danie + opakowanie (za obiad albo za każde danie);
   - nieodwołany obiad = wykorzystany: dzień nalicza się o 9:00, do tej pory klient może zmienić albo odwołać;
   - wpłata liczy się od razu po zgłoszeniu, szefowa odhacza „Przyjęte” (sprawdza z księgową, nie w banku);
   - telefon kuchni tylko wydaje obiady i przyjmuje odwołania. Kwoty w groszach (liczby całkowite). */
'use strict';
(function () {
  var KLUCZ = 'solutor.karnet-demo.v2';
  var ZAMKNIECIE_MIN = 9 * 60;
  var NAZWA_KUCHNI = 'Kuchnia Domowa (przykład)';
  var TELEFONY = ['klient', 'szefowa', 'kuchnia'];
  var DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  var DNI_KROTKO = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
  var DNI_KOLEJNOSC = [1, 2, 3, 4, 5, 6, 0];
  var MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  var PON_PT = [false, true, true, true, true, true, false];
  var CODZIENNIE = [true, true, true, true, true, true, true];
  var GRUPY = [['pozostali', 'Pozostali'], ['emeryci', 'Emeryci i renciści'], ['uczniowie', 'Uczniowie i studenci']];
  var JAK = { miejsce: 'na miejscu', wlasne: 'na wynos, własne naczynie', opakowanie: 'na wynos z opakowaniem' };
  var JAK_KROTKO = { miejsce: 'na miejscu', wlasne: 'wynos, swoje naczynie', opakowanie: 'wynos, opakowanie' };
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
  function ladnaData(s) { var p = s.split('-'); return +p[2] + '.' + p[1]; }
  function dzienIData(s) { return DNI[zData(s).getDay()] + ' ' + ladnaData(s); }
  function krotkoIData(s) { return DNI_KROTKO[zData(s).getDay()] + ' ' + ladnaData(s); }
  function kolejne(od, ile) { var w = []; for (var i = 1; i <= ile; i++) w.push(dodajDni(od, i)); return w; }
  function nazwaMiesiaca(m) { var p = m.split('-'); return MIESIACE[+p[1] - 1] + ' ' + p[0]; }
  function odmiana(n, jeden, kilka, wiele) {
    var a = Math.abs(n), j = a % 10, s = a % 100;
    if (a === 1) return jeden;
    if (j >= 2 && j <= 4 && (s < 12 || s > 14)) return kilka;
    return wiele;
  }
  function obiady(n) { return n + ' ' + odmiana(n, 'obiad', 'obiady', 'obiadów'); }

  /* ---------- pieniądze (grosze) ---------- */
  function zl(gr) {
    var a = Math.abs(gr), c = Math.floor(a / 100), r = a % 100;
    return (gr < 0 ? '-' : '') + c + (r ? ',' + dwa(r) : '') + ' zł';
  }
  function zlPole(gr) { var c = Math.floor(gr / 100), r = gr % 100; return c + (r ? ',' + dwa(r) : ''); }
  function naGrosze(t, ujemne) {
    var s = String(t || '').replace(/\s/g, '').replace(/zł$/i, '').replace(',', '.');
    var wzor = ujemne ? /^-?\d{1,5}(\.\d{1,2})?$/ : /^\d{1,5}(\.\d{1,2})?$/;
    return wzor.test(s) ? Math.round(parseFloat(s) * 100) : null;
  }

  /* ---------- zamówienia i ceny (s = stan, domyślnie bieżący) ---------- */
  function zmianaDnia(id, d, s) {
    s = s || stan;
    for (var i = 0; i < s.zmiany.length; i++) { var z = s.zmiany[i]; if (z.klientId === id && z.data === d) return z; }
    return null;
  }
  function wDniuStalym(k, d) { return d >= k.od && !!k.stale.dni[zData(d).getDay()]; }
  function zamowienie(k, d, s) {
    var z = zmianaDnia(k.id, d, s);
    if (z) return z.nie ? null : { zupa: z.zupa, drugie: z.drugie, jak: z.jak };
    if (!wDniuStalym(k, d)) return null;
    return { zupa: k.stale.zupa, drugie: k.stale.drugie, jak: k.stale.jak };
  }
  function cennikNa(d, s) {
    s = s || stan;
    var c = null;
    s.cennik.forEach(function (x) { if (x.od <= d && (!c || x.od >= c.od)) c = x; });
    return c || s.cennik[0];
  }
  function cenaZam(k, d, z, s) {
    var c = cennikNa(d, s), g = c.grupy[k.grupa] || c.grupy.pozostali;
    var ile = (z.zupa ? 1 : 0) + (z.drugie ? 1 : 0);
    var suma = (z.zupa ? g.zupa : 0) + (z.drugie ? g.drugie : 0);
    if (z.jak === 'opakowanie') suma += c.opakowanieZa === 'danie' ? c.opakowanie * ile : c.opakowanie;
    return suma;
  }
  function cenaStala(k, d) { return cenaZam(k, d, k.stale); }
  function dania(z) { return z.zupa && z.drugie ? 'zupa + drugie danie' : z.zupa ? 'zupa' : 'drugie danie'; }
  function opis(z) { return dania(z) + ', ' + JAK[z.jak]; }
  function opisKrotko(z) { return (z.zupa && z.drugie ? 'zupa + drugie' : z.zupa ? 'zupa' : 'drugie') + ' · ' + JAK_KROTKO[z.jak]; }
  function dniOpis(dni) {
    if (dni.every(Boolean)) return 'codziennie';
    if (dni.join() === PON_PT.join()) return 'pon–pt';
    return DNI_KOLEJNOSC.filter(function (i) { return dni[i]; }).map(function (i) { return DNI_KROTKO[i]; }).join(', ');
  }
  function nazwaGrupy(g) { for (var i = 0; i < GRUPY.length; i++) if (GRUPY[i][0] === g) return GRUPY[i][1]; return g; }

  /* ---------- stan ---------- */
  function nowyKod() {
    var t = new Uint32Array(6), s = '';
    window.crypto.getRandomValues(t);
    for (var i = 0; i < 6; i++) { s += ZNAKI_KODU.charAt(t[i] % ZNAKI_KODU.length); if (i === 2) s += '-'; }
    return s;
  }

  function nowyStan(zParowaniem) {
    var d = dzis(), start = dodajDni(d, -6), wczoraj = dodajDni(d, -1);
    function kl(id, n, kod, apka, grupa, zupa, drugie, jak, dni) {
      return { id: id, nazwa: n, kod: kod, apka: apka, grupa: grupa, od: start, naliczoneDo: wczoraj,
        stale: { zupa: zupa, drugie: drugie, jak: jak, dni: dni.slice() } };
    }
    var s = {
      wersja: 2, licznik: 100,
      klientApka: zParowaniem ? { stan: 'zaproszenie', kod: '', klientId: null }
                              : { stan: 'polaczony', kod: 'K7M-42Q', klientId: 'k-adam' },
      cennik: [{ od: dodajDni(d, -30), opakowanie: 100, opakowanieZa: 'obiad',
        grupy: { pozostali: { zupa: 900, drugie: 2100 }, emeryci: { zupa: 900, drugie: 1600 }, uczniowie: { zupa: 900, drugie: 1600 } } }],
      klienci: [
        kl('k-adam', 'Adam', zParowaniem ? '' : 'K7M-42Q', !zParowaniem, 'pozostali', true, true, 'miejsce', PON_PT),
        kl('k-ewa', 'Ewa (biuro obok)', 'R3T-9XW', true, 'pozostali', false, true, 'wlasne', PON_PT),
        kl('k-marek', 'Marek', 'P4H-7NC', true, 'uczniowie', true, true, 'opakowanie', PON_PT),
        kl('k-halina', 'Pani Halina', '', false, 'emeryci', true, true, 'miejsce', CODZIENNIE),
        kl('k-zosia', 'Zosia z apteki', '', false, 'pozostali', true, false, 'opakowanie', [false, true, true, true, true, true, true])
      ],
      prosby: [], wplaty: [], zmiany: [], naliczenia: [], wydania: []
    };
    function wpl(id, kid, typ, kwota, data, godz, st) {
      s.wplaty.push({ id: id, klientId: kid, typ: typ, kwota: kwota, data: data, zgl: data, godz: godz, stan: st });
    }
    if (zParowaniem) wpl('w1', 'k-adam', 'start', 12000, start, '08:00', 'przyjeta');
    else wpl('w1', 'k-adam', 'przelew', 25000, start, '19:30', 'przyjeta');
    wpl('w2', 'k-ewa', 'start', 10000, start, '08:00', 'przyjeta');
    wpl('w3', 'k-marek', 'start', 20000, start, '08:00', 'przyjeta');
    wpl('w4', 'k-halina', 'start', 30000, start, '08:00', 'przyjeta');
    wpl('w5', 'k-zosia', 'start', 2000, start, '08:00', 'przyjeta');
    // Adam odwołał w aplikacji jeden dzień w ostatnich dniach roboczych.
    for (var i = 2; i <= 5; i++) {
      var x = dodajDni(d, -i);
      if (PON_PT[zData(x).getDay()]) { s.zmiany.push({ klientId: 'k-adam', data: x, nie: true, godz: '07:40', kto: 'klient' }); break; }
    }
    // Minione dni naliczone tak, jak zrobiłaby to aplikacja o 9:00.
    s.klienci.forEach(function (k) {
      for (var x2 = start; x2 <= wczoraj; x2 = dodajDni(x2, 1)) {
        var z = zamowienie(k, x2, s);
        if (z) s.naliczenia.push({ klientId: k.id, data: x2, zupa: z.zupa, drugie: z.drugie, jak: z.jak, kwota: cenaZam(k, x2, z, s) });
      }
    });
    // Dziś rano: Ewa odwołała obiad w aplikacji i zgłosiła przelew.
    s.zmiany.push({ klientId: 'k-ewa', data: d, nie: true, godz: '07:05', kto: 'klient' });
    s.wplaty.push({ id: 'w6', klientId: 'k-ewa', typ: 'przelew', kwota: 20000, data: d, zgl: d, godz: '07:12', stan: 'zgloszona' });
    return s;
  }

  // Pusta kuchnia: same ceny, zero klientów i wpłat — do pokazania od „pierwszego klienta”.
  function pustyStan() {
    var s = nowyStan(true);
    s.klienci = []; s.prosby = []; s.wplaty = []; s.zmiany = []; s.naliczenia = []; s.wydania = [];
    s.cennik = [s.cennik[0]];
    return s;
  }

  function poprawny(o) {
    return o && o.wersja === 2 && o.klientApka && ['klienci', 'prosby', 'wplaty', 'zmiany', 'naliczenia', 'wydania', 'cennik']
      .every(function (k) { return Array.isArray(o[k]); }) && o.cennik.length > 0;
  }
  function wczytaj() {
    try {
      var t = localStorage.getItem(KLUCZ);
      if (t) { var o = JSON.parse(t); if (poprawny(o)) return o; }
    } catch (e) { /* brak pamięci przeglądarki: demo działa do zamknięcia karty */ }
    return /(^|&)pusta(=|&|$)/.test(location.search.slice(1)) ? pustyStan() : nowyStan(false);
  }
  function zapisz() { try { localStorage.setItem(KLUCZ, JSON.stringify(stan)); } catch (e) { /* jw. */ } }

  var stan = wczytaj();
  var ui = { telefon: 'klient', zakladka: 'dzis', szkic: {}, blad: {}, info: {}, edycja: { klient: null, szefowa: null }, miesiac: dzis().slice(0, 7) };

  function klient(id) { for (var i = 0; i < stan.klienci.length; i++) if (stan.klienci[i].id === id) return stan.klienci[i]; return null; }
  function nazwa(id) { var k = klient(id); return k ? k.nazwa : '?'; }
  function saldo(id) {
    var n = 0;
    stan.wplaty.forEach(function (w) { if (w.klientId === id && w.stan !== 'usunieta') n += w.kwota; });
    stan.naliczenia.forEach(function (x) { if (x.klientId === id) n -= x.kwota; });
    return n;
  }
  function wydanie(id, d) { for (var i = 0; i < stan.wydania.length; i++) { var w = stan.wydania[i]; if (w.klientId === id && w.data === d) return w; } return null; }
  function mojId() { return stan.klientApka.stan === 'polaczony' ? stan.klientApka.klientId : null; }
  function noweId(p) { stan.licznik += 1; return p + stan.licznik; }

  /* Naliczanie: o 9:00 dzień się zamyka i każdy, kto nie odwołał, płaci za swoje zamówienie.
     Zapisane naliczenie już się nie zmienia (zmiana cennika czy zamówienia stałego działa na kolejne dni).
     Cofnięcie zegara demo przed 9:00 cofa dzisiejsze naliczenia. */
  function zamknijDni() {
    var d = dzis(), zmienione = false;
    if (przed9()) {
      var ile = stan.naliczenia.length;
      stan.naliczenia = stan.naliczenia.filter(function (n) { return n.data !== d; });
      if (stan.naliczenia.length !== ile) zmienione = true;
      stan.klienci.forEach(function (k) { if (k.naliczoneDo >= d) { k.naliczoneDo = dodajDni(d, -1); zmienione = true; } });
    }
    var ostatni = przed9() ? dodajDni(d, -1) : d;
    stan.klienci.forEach(function (k) {
      var x = k.naliczoneDo ? dodajDni(k.naliczoneDo, 1) : k.od;
      if (x < k.od) x = k.od;
      if (x > ostatni) return;
      for (var n = 0; x <= ostatni && n < 400; n++, x = dodajDni(x, 1)) {
        var z = zamowienie(k, x);
        if (z) stan.naliczenia.push({ klientId: k.id, data: x, zupa: z.zupa, drugie: z.drugie, jak: z.jak, kwota: cenaZam(k, x, z) });
      }
      k.naliczoneDo = ostatni;
      zmienione = true;
    });
    return zmienione;
  }
  // Po 9:00 szefowa może zwolnić z opłaty (albo przywrócić obiad): dzisiejsze naliczenie liczone od nowa.
  function przeliczDzis(k) {
    var d = dzis();
    if (przed9()) return;
    stan.naliczenia = stan.naliczenia.filter(function (n) { return !(n.klientId === k.id && n.data === d); });
    var z = zamowienie(k, d);
    if (z) stan.naliczenia.push({ klientId: k.id, data: d, zupa: z.zupa, drugie: z.drugie, jak: z.jak, kwota: cenaZam(k, d, z) });
  }
  function ustawZmiane(id, d, dane, kto) {
    var bylo = zmianaDnia(id, d), poprzednie = null;
    // Odwołanie zapamiętuje zmienione zamówienie z tego dnia („tylko zupa”), żeby przywrócenie do niego wróciło.
    if (dane.nie && bylo) poprzednie = bylo.nie ? bylo.poprzednie || null : { zupa: bylo.zupa, drugie: bylo.drugie, jak: bylo.jak };
    stan.zmiany = stan.zmiany.filter(function (z) { return !(z.klientId === id && z.data === d); });
    stan.zmiany.push({ klientId: id, data: d, nie: !!dane.nie, zupa: !!dane.zupa, drugie: !!dane.drugie, jak: dane.jak || 'miejsce',
      poprzednie: poprzednie, godz: godzTeraz(), kto: kto });
  }
  // Cofnięcie odwołania: wraca zamówienie sprzed odwołania, a gdy go nie było — stałe (także w dzień spoza stałych).
  function cofnijOdwolanie(k, d, kto) {
    var zm = zmianaDnia(k.id, d);
    if (zm && zm.nie && zm.poprzednie) { ustawZmiane(k.id, d, zm.poprzednie, kto); return; }
    usunZmiane(k.id, d);
    if (!zamowienie(k, d)) ustawZmiane(k.id, d, k.stale, kto);
  }
  function usunZmiane(id, d) { stan.zmiany = stan.zmiany.filter(function (z) { return !(z.klientId === id && z.data === d); }); }

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
  function doKuchni(tekst, klucz) { oznacz(['szefowa', 'kuchnia'], klucz); dymek('szefowa', tekst); dymek('kuchnia', tekst); }

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
  function poleKwoty(etykieta, id, domyslna) {
    return pole(etykieta, id, { type: 'text', inputmode: 'decimal', autocomplete: 'off', maxlength: 9 }, domyslna);
  }
  function wybor(etykieta, id, opcje, domyslna, poZmianie) {
    var biezaca = ui.szkic[id] !== undefined ? ui.szkic[id] : domyslna;
    var s = el('select', { id: id }, opcje.map(function (o) {
      return el('option', { value: o[0], selected: o[0] === biezaca, tekst: o[1] });
    }));
    var poWyborze = function () { ui.szkic[id] = s.value; if (poZmianie) poZmianie(s.value); };
    s.addEventListener('change', poWyborze);
    s.addEventListener('input', poWyborze);
    return etykieta === null ? s : el('label', { klasa: 'pole', for: id }, [etykieta, s]);
  }
  function znacznik(etykieta, id, domyslny) {
    var v = ui.szkic[id] !== undefined ? ui.szkic[id] === '1' : !!domyslny;
    var i = el('input', { type: 'checkbox', id: id, checked: v });
    i.addEventListener('change', function () { ui.szkic[id] = i.checked ? '1' : '0'; });
    return el('label', { klasa: 'pole-wyboru', for: id }, [i, etykieta]);
  }
  function wartosc(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function zaznaczone(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function wyczyscSzkic(prefix) { Object.keys(ui.szkic).forEach(function (k) { if (k.indexOf(prefix) === 0) delete ui.szkic[k]; }); }
  function komunikat(klucz) {
    var b = ui.blad[klucz], i = ui.info[klucz];
    return el('p', { klasa: 'komunikat' + (b ? ' blad' : ''), role: 'status', tekst: b || i || '' });
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

  // Edytor zamówienia: zupa, drugie danie, jak (i dni tygodnia dla zamówienia stałego).
  function edytor(prefix, w, zDniami) {
    var czesci = [
      el('div', { klasa: 'wybor-dan' }, [znacznik('Zupa', prefix + '-zupa', w.zupa), znacznik('Drugie danie', prefix + '-drugie', w.drugie)]),
      wybor('Jak', prefix + '-jak', [['miejsce', 'Na miejscu'], ['wlasne', 'Na wynos, własne naczynie'], ['opakowanie', 'Na wynos z opakowaniem']], w.jak)
    ];
    if (zDniami) {
      czesci.push(el('fieldset', { klasa: 'dni' }, [el('legend', { tekst: 'W które dni' })].concat(
        DNI_KOLEJNOSC.map(function (i) { return znacznik(DNI_KROTKO[i], prefix + '-d' + i, w.dni[i]); }))));
    }
    return el('div', { klasa: 'edytor' }, czesci);
  }
  function czytajEdytor(prefix, zDniami) {
    var w = { zupa: zaznaczone(prefix + '-zupa'), drugie: zaznaczone(prefix + '-drugie'), jak: wartosc(prefix + '-jak') || 'miejsce' };
    if (!w.zupa && !w.drugie) return { blad: 'Zaznacz zupę, drugie danie albo oba.' };
    if (zDniami) {
      w.dni = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return zaznaczone(prefix + '-d' + i); });
      if (!w.dni.some(Boolean)) return { blad: 'Zaznacz przynajmniej jeden dzień.' };
    }
    return { w: w };
  }

  /* ---------- akcje ---------- */
  function zmiana() { zamknijDni(); zapisz(); rysuj(); }
  function kiedy(d) { return d === dzis() ? 'dziś' : krotkoIData(d); }

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
    var p = 'pr-' + kod, kogo = wartosc(p + '-kto') || 'nowy', k;
    if (kogo === 'nowy') {
      var n = wartosc(p + '-nazwa').trim();
      if (!n) { ui.blad[p] = 'Wpisz nazwę, pod którą chcesz widzieć tego klienta.'; rysuj(); return; }
      var d = dzis();
      k = { id: noweId('k'), nazwa: n.slice(0, 40), kod: kod, apka: true, grupa: wartosc(p + '-grupa') || 'pozostali',
        od: d, naliczoneDo: przed9() ? dodajDni(d, -1) : d, stale: { zupa: true, drugie: true, jak: 'miejsce', dni: PON_PT.slice() } };
      stan.klienci.push(k);
    } else {
      k = klient(kogo);
      if (!k) return;
      k.apka = true;
      k.kod = kod;
    }
    delete ui.blad[p];
    wyczyscSzkic(p);
    stan.prosby = stan.prosby.filter(function (x) { return x.kod !== kod; });
    if (stan.klientApka.kod === kod) {
      stan.klientApka.stan = 'polaczony';
      stan.klientApka.klientId = k.id;
      oznacz(['klient'], 'licznik');
      dymek('klient', 'Kuchnia potwierdziła połączenie. Na koncie: ' + zl(saldo(k.id)) + '.');
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
    var kwota = naGrosze(wartosc('kl-kwota'));
    var data = wartosc('kl-data') || dzis();
    if (!kwota || kwota > 500000) { ui.blad.klient = 'Wpisz kwotę przelewu, np. 250 albo 250,50.'; rysuj(); return; }
    if (data > dzis()) { ui.blad.klient = 'Data przelewu nie może być z przyszłości.'; rysuj(); return; }
    delete ui.blad.klient;
    var w = { id: noweId('w'), klientId: id, typ: 'przelew', kwota: kwota, data: data, zgl: dzis(), godz: godzTeraz(), stan: 'zgloszona' };
    stan.wplaty.push(w);
    delete ui.szkic['kl-kwota'];
    oznacz(['szefowa'], 'wpl-' + w.id);
    oznacz(['klient'], 'licznik');
    dymek('szefowa', nazwa(id) + ': wpłata ' + zl(kwota) + ' do odhaczenia');
    zmiana();
  }

  function przyjmij(wid) {
    stan.wplaty.forEach(function (w) { if (w.id === wid && w.stan === 'zgloszona') { w.stan = 'przyjeta'; w.przyjeta = dzis() + ' ' + godzTeraz(); } });
    zmiana();
  }
  function usunWplate(wid) {
    stan.wplaty.forEach(function (w) {
      if (w.id !== wid || w.stan !== 'zgloszona') return;
      w.stan = 'usunieta';
      if (w.klientId === mojId()) {
        oznacz(['klient'], 'licznik');
        dymek('klient', 'Kuchnia nie ma wpłaty ' + zl(w.kwota) + ' i usunęła ją z konta.');
      }
    });
    zmiana();
  }
  function zamknijUsuniete() {
    var id = mojId();
    stan.wplaty.forEach(function (w) { if (w.klientId === id && w.stan === 'usunieta') w.przeczytana = true; });
    zmiana();
  }

  function zapiszWplateRecznie() {
    var id = wartosc('sz-klient');
    var kwota = naGrosze(wartosc('sz-kwota'));
    if (!klient(id)) { ui.blad.szWplata = 'Wybierz klienta.'; rysuj(); return; }
    if (!kwota || kwota > 500000) { ui.blad.szWplata = 'Wpisz kwotę, np. 250 albo 250,50.'; rysuj(); return; }
    delete ui.blad.szWplata;
    var w = { id: noweId('w'), klientId: id, typ: 'gotowka', kwota: kwota, data: dzis(), zgl: dzis(), godz: godzTeraz(), stan: 'przyjeta' };
    stan.wplaty.push(w);
    delete ui.szkic['sz-kwota'];
    oznacz(['szefowa'], 'wpl-' + w.id);
    if (id === mojId()) { oznacz(['klient'], 'licznik'); dymek('klient', 'Kuchnia zapisała wpłatę ' + zl(kwota) + '. Na koncie: ' + zl(saldo(id)) + '.'); }
    zmiana();
  }

  function dodajKlienta() {
    var n = wartosc('sz-nazwa').trim();
    var ile = naGrosze(wartosc('sz-start') || '0', true);
    if (!n) { ui.blad.szKlient = 'Wpisz nazwę klienta.'; rysuj(); return; }
    if (ile === null) { ui.blad.szKlient = 'Stan z zeszytu w złotych, np. 120 albo -30.'; rysuj(); return; }
    delete ui.blad.szKlient;
    var d = dzis();
    var k = { id: noweId('k'), nazwa: n.slice(0, 40), kod: '', apka: false, grupa: wartosc('sz-grupa') || 'pozostali',
      od: d, naliczoneDo: przed9() ? dodajDni(d, -1) : d, stale: { zupa: true, drugie: true, jak: 'miejsce', dni: PON_PT.slice() } };
    stan.klienci.push(k);
    if (ile !== 0) stan.wplaty.push({ id: noweId('w'), klientId: k.id, typ: 'start', kwota: ile, data: d, zgl: d, godz: godzTeraz(), stan: 'przyjeta' });
    wyczyscSzkic('sz-nazwa'); wyczyscSzkic('sz-start');
    oznacz(['szefowa', 'kuchnia'], 'kl-' + k.id);
    zmiana();
  }

  function zapiszKlienta(kid) {
    var k = klient(kid);
    if (!k) return;
    if (!k.apka) {
      var r = czytajEdytor('se', true);
      if (r.blad) { ui.blad.szEdycja = r.blad; rysuj(); return; }
      k.stale = r.w;
    }
    k.grupa = wartosc('se-grupa') || k.grupa;
    delete ui.blad.szEdycja;
    ui.edycja.szefowa = null;
    wyczyscSzkic('se-');
    oznacz(['szefowa', 'kuchnia'], 'kl-' + k.id);
    zmiana();
  }

  function zapiszCennik() {
    var od = wartosc('cn-od'), c = { od: od, grupy: {}, opakowanie: naGrosze(wartosc('cn-opak')), opakowanieZa: wartosc('cn-za') === 'danie' ? 'danie' : 'obiad' };
    var zle = false;
    GRUPY.forEach(function (g) {
      var z = naGrosze(wartosc('cn-' + g[0] + '-zupa')), dr = naGrosze(wartosc('cn-' + g[0] + '-drugie'));
      if (!z || !dr) zle = true;
      c.grupy[g[0]] = { zupa: z, drugie: dr };
    });
    if (zle || c.opakowanie === null) { ui.blad.cennik = 'Wpisz wszystkie ceny w złotych, np. 9 albo 8,50 (opakowanie może być 0).'; rysuj(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(od) || od < dzis()) { ui.blad.cennik = 'Data „od” musi być dzisiejsza albo późniejsza.'; rysuj(); return; }
    delete ui.blad.cennik;
    stan.cennik = stan.cennik.filter(function (x) { return x.od !== od; });
    stan.cennik.push(c);
    stan.cennik.sort(function (a, b) { return a.od < b.od ? -1 : a.od > b.od ? 1 : 0; });
    wyczyscSzkic('cn-');
    ui.info.cennik = 'Zapisano. Ceny obowiązują od ' + ladnaData(od) + '; dni już naliczone się nie zmieniają.';
    oznacz(['klient'], 'cennik');
    if (mojId()) dymek('klient', 'Kuchnia zmieniła cennik od ' + ladnaData(od) + '.');
    zmiana();
  }

  function drugi(kto) { return kto === 'szefowa' ? 'kuchnia' : 'szefowa'; }

  function wydaj(id, kto) {
    var d = dzis();
    if (wydanie(id, d)) return;
    stan.wydania.push({ klientId: id, data: d, godz: godzTeraz(), kto: kto });
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) { oznacz(['klient'], 'dzien-' + d); dymek('klient', 'Obiad wydany.'); }
    zmiana();
  }
  function cofnijWydanie(id, kto) {
    var d = dzis();
    stan.wydania = stan.wydania.filter(function (w) { return !(w.klientId === id && w.data === d); });
    oznacz([drugi(kto)], 'dz-' + id);
    zmiana();
  }
  function odwolaj(id, kto) {
    var d = dzis(), k = klient(id), byl = przed9();
    if (!byl && kto !== 'szefowa') return;
    var cena = 0;
    stan.naliczenia.forEach(function (n) { if (n.klientId === id && n.data === d) cena = n.kwota; });
    ustawZmiane(id, d, { nie: true }, kto);
    przeliczDzis(k);
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) {
      oznacz(['klient'], 'dzien-' + d);
      dymek('klient', byl ? 'Kuchnia zapisała, że dziś nie bierzesz obiadu.' : 'Szefowa zwolniła Cię z dzisiejszej opłaty (' + zl(cena) + ' wraca na konto).');
    }
    zmiana();
  }
  function przywroc(id, kto) {
    var d = dzis(), k = klient(id);
    if (!przed9() && kto !== 'szefowa') return;
    cofnijOdwolanie(k, d, kto);
    przeliczDzis(k);
    oznacz([drugi(kto)], 'dz-' + id);
    if (id === mojId()) { oznacz(['klient'], 'dzien-' + d); dymek('klient', 'Kuchnia zapisała, że jednak bierzesz dziś obiad.'); }
    zmiana();
  }

  function moznaZmieniac(d) { return d > dzis() || (d === dzis() && przed9()); }
  function klientNieBiore(d) {
    var id = mojId();
    if (!id || !moznaZmieniac(d)) return;
    ustawZmiane(id, d, { nie: true }, 'klient');
    ui.edycja.klient = null;
    oznacz(['klient'], 'dzien-' + d);
    doKuchni(nazwa(id) + ' nie bierze obiadu ' + kiedy(d), d === dzis() ? 'dz-' + id : 'pl-' + d);
    zmiana();
  }
  function klientJakZwykle(d) {
    var id = mojId(), k = klient(id);
    if (!id || !moznaZmieniac(d)) return;
    usunZmiane(id, d);
    ui.edycja.klient = null;
    oznacz(['klient'], 'dzien-' + d);
    var z = zamowienie(k, d);
    doKuchni(nazwa(id) + ' ' + kiedy(d) + ': ' + (z ? 'jak zwykle, ' + opisKrotko(z) : 'nie bierze obiadu'), d === dzis() ? 'dz-' + id : 'pl-' + d);
    zmiana();
  }
  function klientJednakBiore(d) {
    var id = mojId(), k = klient(id);
    if (!id || !moznaZmieniac(d)) return;
    cofnijOdwolanie(k, d, 'klient');
    oznacz(['klient'], 'dzien-' + d);
    doKuchni(nazwa(id) + ' jednak bierze obiad ' + kiedy(d) + ': ' + opisKrotko(zamowienie(k, d)), d === dzis() ? 'dz-' + id : 'pl-' + d);
    zmiana();
  }
  function klientZapiszDzien(d) {
    var id = mojId(), k = klient(id);
    if (!id) return;
    if (!moznaZmieniac(d)) { ui.blad.klientDzien = 'Po 9:00 zmiany na dziś tylko telefonicznie u szefowej.'; rysuj(); return; }
    var r = czytajEdytor('kd', false);
    if (r.blad) { ui.blad.klientDzien = r.blad; rysuj(); return; }
    delete ui.blad.klientDzien;
    var s = k.stale;
    if (wDniuStalym(k, d) && r.w.zupa === s.zupa && r.w.drugie === s.drugie && r.w.jak === s.jak) usunZmiane(id, d);
    else ustawZmiane(id, d, r.w, 'klient');
    ui.edycja.klient = null;
    wyczyscSzkic('kd-');
    oznacz(['klient'], 'dzien-' + d);
    doKuchni(nazwa(id) + ' ' + kiedy(d) + ': ' + opisKrotko(r.w), d === dzis() ? 'dz-' + id : 'pl-' + d);
    zmiana();
  }
  function klientZapiszStale() {
    var id = mojId(), k = klient(id);
    if (!id) return;
    var r = czytajEdytor('ks', true);
    if (r.blad) { ui.blad.klientStale = r.blad; rysuj(); return; }
    delete ui.blad.klientStale;
    k.stale = r.w;
    ui.edycja.klient = null;
    wyczyscSzkic('ks-');
    oznacz(['klient'], 'stale');
    doKuchni(nazwa(id) + ' ma nowe stałe zamówienie: ' + opisKrotko(r.w) + ', ' + dniOpis(r.w.dni), 'kl-' + id);
    zmiana();
  }
  function edytuj(kto, co, prefix) {
    ui.edycja[kto] = co;
    wyczyscSzkic(prefix);
    ui.blad.klientDzien = ui.blad.klientStale = ui.blad.szEdycja = undefined;
    rysuj();
  }

  // Zestawienie wpłat dla księgowości
  function wplatyMiesiaca(m) {
    return stan.wplaty.filter(function (w) { return w.typ !== 'start' && w.stan !== 'usunieta' && w.data.slice(0, 7) === m; })
      .sort(function (a, b) { var x = a.data + a.godz, y = b.data + b.godz; return x < y ? -1 : x > y ? 1 : 0; });
  }
  function kopiujZestawienie() {
    var lista = wplatyMiesiaca(ui.miesiac), suma = 0;
    var linie = ['Wpłaty za ' + nazwaMiesiaca(ui.miesiac) + ' (' + NAZWA_KUCHNI + ')', 'Data\tKlient\tKwota\tSposób'];
    lista.forEach(function (w) { suma += w.kwota; linie.push(ladnaData(w.data) + '\t' + nazwa(w.klientId) + '\t' + zlPole(w.kwota) + '\t' + (w.typ === 'gotowka' ? 'gotówka' : 'przelew')); });
    linie.push('Razem\t\t' + zlPole(suma) + '\t');
    var tekst = linie.join('\n');
    var ok = function () { ui.info.zest = 'Skopiowano. Wklej do e-maila albo arkusza.'; delete ui.blad.zest; rysuj(); };
    var zle = function () { ui.blad.zest = 'Nie udało się skopiować. Użyj „Drukuj”.'; rysuj(); };
    try { navigator.clipboard.writeText(tekst).then(ok, zle); } catch (e) { zle(); }
  }
  function drukujZestawienie() {
    document.body.classList.add('druk');
    window.print();
    document.body.classList.remove('druk');
  }

  /* ---------- widok klienta ---------- */
  function przyciskiDnia(k, d, maly) {
    var id = k.id, z = zamowienie(k, d), zm = zmianaDnia(id, d), m = maly ? 'maly ' : '';
    if (wydanie(id, d)) return [];
    var otwarte = moznaZmieniac(d);
    var b = [];
    if (z) {
      b.push(przycisk('Zmień', m, function () { edytuj('klient', d, 'kd-'); }, !otwarte));
      b.push(przycisk('Nie biorę', m + (maly ? '' : 'glowny'), function () { klientNieBiore(d); }, !otwarte));
    } else if (zm && zm.nie && (wDniuStalym(k, d) || zm.poprzednie)) {
      b.push(przycisk('Jednak biorę', m, function () { klientJednakBiore(d); }, !otwarte));
    } else {
      b.push(przycisk('Biorę', m, function () { edytuj('klient', d, 'kd-'); }, !otwarte));
    }
    return b;
  }
  function edytorDnia(k, d) {
    var z = zamowienie(k, d) || k.stale, zm = zmianaDnia(k.id, d);
    var cena = el('p', { klasa: 'drobny', tekst: 'Cena tego dnia: ' + zl(cenaZam(k, d, z)) });
    var ed = edytor('kd', z, false);
    ed.addEventListener('change', function () {
      var r = czytajEdytor('kd', false);
      cena.textContent = r.blad ? r.blad : 'Cena tego dnia: ' + zl(cenaZam(k, d, r.w));
    });
    return el('div', { klasa: 'edytor-dnia pelny' }, [
      ed,
      cena,
      el('div', { klasa: 'przyciski na-prawo' }, [
        przycisk('Anuluj', 'maly', function () { edytuj('klient', null, 'kd-'); }),
        zm && wDniuStalym(k, d) ? przycisk('Jak zwykle', 'maly', function () { klientJakZwykle(d); }) : null,
        przycisk('Zapisz', 'maly glowny', function () { klientZapiszDzien(d); })
      ]),
      komunikat('klientDzien')
    ]);
  }

  function widokKlienta() {
    var a = stan.klientApka, t = [];
    t.push(el('h2', { tekst: NAZWA_KUCHNI }));
    if (a.stan === 'zaproszenie' || a.stan === 'odrzucony') {
      if (a.stan === 'odrzucony') t.push(el('p', { klasa: 'uwaga zla', tekst: 'Kuchnia nie potwierdziła połączenia. Zadzwoń do kuchni albo spróbuj jeszcze raz.' }));
      else t.push(el('p', { tekst: 'Kuchnia zaprasza Cię do karnetu na obiady. Po połączeniu zobaczysz tu stan konta, zgłosisz wpłatę, a obiad zmienisz albo odwołasz do 9:00.' }));
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

    var id = a.klientId, k = klient(id), d = dzis(), s = saldo(id), dzienna = cenaStala(k, d);
    t.push(el('div', { klasa: 'licznik' + (s < 0 ? ' minus' : '') + blysk('klient', 'licznik') }, [
      el('div', { klasa: 'licznik-liczba', tekst: zl(s) }),
      el('div', { klasa: 'licznik-pod', tekst: s < 0 ? 'do dopłaty' : s === 0 ? 'na koncie. Zgłoś wpłatę poniżej, gdy zrobisz przelew.'
        : 'na koncie, wystarczy na około ' + obiady(Math.floor(s / dzienna)) + ' po ' + zl(dzienna) })
    ]));
    var zgl = stan.wplaty.filter(function (w) { return w.klientId === id && w.stan === 'zgloszona'; });
    if (zgl.length) t.push(el('p', { klasa: 'drobny', tekst: 'Wpłata ' + zl(zgl[zgl.length - 1].kwota) + ' jest już wliczona; kuchnia jeszcze jej nie odhaczyła.' }));
    var usuniete = stan.wplaty.filter(function (w) { return w.klientId === id && w.stan === 'usunieta' && !w.przeczytana; });
    if (usuniete.length) {
      var u = usuniete[usuniete.length - 1];
      t.push(el('div', { klasa: 'uwaga zla' }, [
        el('p', { klasa: 'bez-marginesu', tekst: 'Kuchnia nie ma wpłaty ' + zl(u.kwota) + ' z ' + ladnaData(u.data) + ' i usunęła ją z konta. Sprawdź przelew albo zadzwoń do kuchni.' }),
        przycisk('Rozumiem', 'maly szeroki', zamknijUsuniete)
      ]));
    }
    // Zapowiedziana zmiana cennika
    var nast = stan.cennik.filter(function (c) { return c.od > d; })[0];
    if (nast) {
      var nowa = cenaZam(k, nast.od, k.stale);
      if (nowa !== dzienna) t.push(el('p', { klasa: 'uwaga' + blysk('klient', 'cennik'), tekst: 'Od ' + ladnaData(nast.od) + ' Twój obiad kosztuje ' + zl(nowa) + ' (teraz ' + zl(dzienna) + ').' }));
    }

    // Dziś
    t.push(el('h3', { tekst: 'Dziś, ' + dzienIData(d) }));
    var wyd = wydanie(id, d), zDzis = zamowienie(k, d), zmDzis = zmianaDnia(id, d), naliczone = null;
    stan.naliczenia.forEach(function (n) { if (n.klientId === id && n.data === d) naliczone = n; });
    var stanDnia;
    if (wyd) stanDnia = el('p', { klasa: 'dzien-stan tak', tekst: 'Obiad odebrany o ' + ladnaGodz(wyd.godz) + ': ' + opis(zDzis || k.stale) + '.' });
    else if (zDzis) stanDnia = el('p', { klasa: 'dzien-stan tak', tekst: 'Bierzesz: ' + opis(zDzis) + ', ' + zl(cenaZam(k, d, zDzis)) + '.' });
    else stanDnia = el('p', { klasa: 'dzien-stan nie', tekst: zmDzis && zmDzis.nie ? 'Dziś nie bierzesz obiadu' + (zmDzis.kto === 'klient' ? '.' : ' (zapisała kuchnia).') : 'Dziś nie bierzesz obiadu (poza Twoimi stałymi dniami).' });
    t.push(el('div', { klasa: blysk('klient', 'dzien-' + d).trim() || null }, [stanDnia]));
    if (ui.edycja.klient === d) t.push(edytorDnia(k, d));
    else if (!wyd) {
      var bd = przyciskiDnia(k, d, false);
      if (bd.length) t.push(el('div', { klasa: 'rzad-przyciskow' }, bd));
    }
    if (przed9()) {
      var zostalo = ZAMKNIECIE_MIN - minutyTeraz();
      var ile = zostalo >= 60 ? Math.floor(zostalo / 60) + ' h ' + (zostalo % 60) + ' min' : zostalo + ' min';
      t.push(el('p', { klasa: 'drobny', tekst: 'Zmiany na dziś do 9:00 (zostało ' + ile + '). O 9:00 obiad się nalicza, także gdy go nie odbierzesz.' }));
    } else {
      t.push(el('p', { klasa: 'drobny', tekst: (naliczone ? 'Naliczone o 9:00: ' + zl(naliczone.kwota) + '. ' : '') + 'Po 9:00 zmiany na dziś tylko telefonicznie u szefowej.' }));
    }

    // Najbliższe dni
    t.push(el('h3', { tekst: 'Najbliższe dni' }));
    var lista = el('ul', { klasa: 'lista' });
    kolejne(d, 7).forEach(function (dz) {
      var z = zamowienie(k, dz), zm = zmianaDnia(id, dz);
      if (ui.edycja.klient === dz) {
        lista.appendChild(el('li', { klasa: 'formularz' }, [el('span', { klasa: 'imie pelny', tekst: krotkoIData(dz) }), edytorDnia(k, dz)]));
        return;
      }
      var meta = z ? opisKrotko(z) + ' · ' + zl(cenaZam(k, dz, z)) + (zm ? ' (zmienione)' : '') : (zm && zm.nie ? 'nie biorę' : 'nie biorę (poza stałymi dniami)');
      lista.appendChild(wiersz((z ? '' : zm && zm.nie ? 'nieobecny' : 'wolny') + blysk('klient', 'dzien-' + dz) || null, krotkoIData(dz), null, meta, false, przyciskiDnia(k, dz, true)));
    });
    t.push(lista);
    t.push(el('p', { klasa: 'drobny', tekst: 'Urlop, „dziś tylko zupa” albo „na wynos” zaznaczysz z wyprzedzeniem. Kuchnia widzi to od razu.' }));

    // Stałe zamówienie
    t.push(el('h3', { tekst: 'Moje stałe zamówienie' }));
    if (ui.edycja.klient === 'stale') {
      t.push(edytor('ks', k.stale, true));
      t.push(el('div', { klasa: 'przyciski na-prawo rzad-przyciskow' }, [
        przycisk('Anuluj', 'maly', function () { edytuj('klient', null, 'ks-'); }),
        przycisk('Zapisz', 'maly glowny', klientZapiszStale)
      ]));
      t.push(komunikat('klientStale'));
    } else {
      t.push(el('div', { klasa: 'stale' + blysk('klient', 'stale') }, [
        el('p', { klasa: 'bez-marginesu', tekst: opis(k.stale) + ', ' + dniOpis(k.stale.dni) + '. ' + zl(dzienna) + ' za dzień.' }),
        przycisk('Zmień', 'maly', function () { edytuj('klient', 'stale', 'ks-'); })
      ]));
      t.push(el('p', { klasa: 'drobny', tekst: 'Cena dla grupy „' + nazwaGrupy(k.grupa) + '”, ustawia ją kuchnia. Zmiana działa od najbliższego dnia, który nie jest jeszcze naliczony.' }));
    }

    // Wpłata
    t.push(el('h3', { tekst: 'Zrobiłem przelew' }));
    t.push(el('div', { klasa: 'pola' }, [
      poleKwoty('Kwota (zł)', 'kl-kwota', '250'),
      pole('Data przelewu', 'kl-data', { type: 'date', max: d }, d)
    ]));
    t.push(el('p', { klasa: 'drobny', tekst: 'Wpłata od razu zwiększa stan konta. Kuchnia odhaczy ją, gdy sprawdzi z księgową.' }));
    t.push(przycisk('Zgłoś wpłatę', 'glowny szeroki', zglosWplate));
    t.push(komunikat('klient'));

    // Historia
    t.push(el('h3', { tekst: 'Historia' }));
    var h = [];
    stan.wplaty.forEach(function (w) {
      if (w.klientId !== id) return;
      var o = w.typ === 'start' ? 'Stan z zeszytu' : 'Wpłata' + (w.typ === 'gotowka' ? ' gotówką' : '') + (w.stan === 'usunieta' ? ' (usunięta przez kuchnię)' : '');
      h.push({ k: w.zgl + ' ' + w.godz, opis: o, meta: ladnaData(w.data) + ' · ' + (w.stan === 'usunieta' ? '' : '+') + zl(w.kwota), zla: w.stan === 'usunieta' });
    });
    stan.naliczenia.forEach(function (n) {
      if (n.klientId === id) h.push({ k: n.data + ' 09:00', opis: 'Obiad: ' + opisKrotko(n), meta: ladnaData(n.data) + ' · -' + zl(n.kwota) });
    });
    stan.zmiany.forEach(function (z) {
      if (z.klientId === id && z.nie && z.data <= d && wDniuStalym(k, z.data)) h.push({ k: z.data + ' 08:59', opis: 'Odwołany', meta: ladnaData(z.data) + ' · 0 zł' });
    });
    h.sort(function (x, y) { return x.k < y.k ? 1 : x.k > y.k ? -1 : 0; });
    var hl = el('ul', { klasa: 'lista' });
    h.slice(0, 10).forEach(function (x) { hl.appendChild(wiersz(null, x.opis, null, x.meta, x.zla)); });
    if (!h.length) hl.appendChild(pusto('Jeszcze nic.'));
    t.push(hl);
    t.push(el('p', { klasa: 'drobny' }, ['Twój kod w tej kuchni: ', el('span', { klasa: 'kod', tekst: a.kod }), '. Kuchnia widzi Cię pod nazwą, którą sama nadała.']));
    return t;
  }

  /* ---------- widoki kuchni ---------- */
  function sumyDnia(d) {
    var s = { zupy: 0, drugie: 0, opakowania: 0, nie: [] };
    stan.klienci.forEach(function (k) {
      var z = zamowienie(k, d), zm = zmianaDnia(k.id, d);
      if (z) {
        if (z.zupa) s.zupy++;
        if (z.drugie) s.drugie++;
        if (z.jak === 'opakowanie') s.opakowania += (z.zupa ? 1 : 0) + (z.drugie ? 1 : 0);
      } else if (zm && zm.nie && wDniuStalym(k, d)) s.nie.push(k.nazwa);
    });
    return s;
  }

  function widokDzis(kto) {
    var szef = kto === 'szefowa', t = [], d = dzis(), otwarte = przed9();
    t.push(el('h2', { tekst: 'Wydawka: ' + dzienIData(d) }));
    var doWyd = [], wydane = [], odw = [];
    stan.klienci.forEach(function (k) {
      var z = zamowienie(k, d), zm = zmianaDnia(k.id, d), w = wydanie(k.id, d);
      if (z) (w ? wydane : doWyd).push({ k: k, z: z, w: w });
      else if (zm && zm.nie && wDniuStalym(k, d)) odw.push({ k: k, zm: zm });
    });
    var po = function (x, y) { return x.k.nazwa.localeCompare(y.k.nazwa, 'pl'); };
    doWyd.sort(po); wydane.sort(po); odw.sort(po);
    var s = sumyDnia(d);
    t.push(el('div', { klasa: 'liczby' }, [
      el('div', null, [el('b', { tekst: String(s.zupy) }), el('span', { tekst: odmiana(s.zupy, 'zupa', 'zupy', 'zup') })]),
      el('div', null, [el('b', { tekst: String(s.drugie) }), el('span', { tekst: 'drugie' })]),
      el('div', null, [el('b', { tekst: String(s.opakowania) }), el('span', { tekst: odmiana(s.opakowania, 'opakowanie', 'opakowania', 'opakowań') })])
    ]));
    t.push(otwarte
      ? el('p', { klasa: 'uwaga', tekst: 'Do 9:00 klienci mogą jeszcze zmieniać i odwoływać. Wydano ' + wydane.length + ' z ' + (doWyd.length + wydane.length) + '.' })
      : el('p', { klasa: 'uwaga ok', tekst: 'Lista zamknięta o 9:00, liczby u góry są ostateczne. Wydano ' + wydane.length + ' z ' + (doWyd.length + wydane.length) + '.' }));

    var znak = function (k) { return k.apka ? null : 'bez aplikacji'; };
    var meta = function (k, z) {
      var sal = saldo(k.id);
      return { tekst: opisKrotko(z) + (szef ? ' · konto ' + zl(sal) : ''), zla: szef && sal < 0 };
    };
    var ul = el('ul', { klasa: 'lista' });
    doWyd.forEach(function (x) {
      var m = meta(x.k, x.z), b = [];
      if (otwarte) b.push(przycisk('Nie będzie', 'maly', function () { odwolaj(x.k.id, kto); }));
      else if (szef) b.push(przycisk('Bez opłaty', 'maly', function () { odwolaj(x.k.id, kto); }));
      b.push(przycisk('Wydano', 'wydaj', function () { wydaj(x.k.id, kto); }));
      ul.appendChild(wiersz(blysk(kto, 'dz-' + x.k.id).trim() || null, x.k.nazwa, znak(x.k), m.tekst, m.zla, b));
    });
    wydane.forEach(function (x) {
      var m = meta(x.k, x.z);
      ul.appendChild(wiersz('wydany' + blysk(kto, 'dz-' + x.k.id), x.k.nazwa, znak(x.k), 'wydano ' + ladnaGodz(x.w.godz) + ' · ' + m.tekst, m.zla,
        [przycisk('Cofnij', 'maly', function () { cofnijWydanie(x.k.id, kto); })]));
    });
    odw.forEach(function (x) {
      var skad = x.zm.kto === 'klient' ? 'w aplikacji' : x.zm.kto === 'kuchnia' ? 'telefon kuchni' : 'szefowa';
      ul.appendChild(wiersz('nieobecny' + blysk(kto, 'dz-' + x.k.id), x.k.nazwa, znak(x.k), 'odwołane ' + ladnaGodz(x.zm.godz) + ' (' + skad + ')', false,
        otwarte || szef ? [przycisk('Przywróć', 'maly', function () { przywroc(x.k.id, kto); })] : null));
    });
    if (!doWyd.length && !wydane.length && !odw.length) ul.appendChild(pusto('Dziś nikt nie zamówił.'));
    t.push(ul);
    if (!otwarte) t.push(el('p', { klasa: 'drobny', tekst: szef
      ? 'Po 9:00 obiad jest naliczony. „Bez opłaty” odwołuje go i zwraca pieniądze na konto klienta.'
      : 'Po 9:00 odwołać obiad bez opłaty może tylko szefowa.' }));

    t.push(el('h3', { tekst: 'Najbliższe dni' }));
    var pl = el('ul', { klasa: 'lista' });
    kolejne(d, 3).forEach(function (dz) {
      var sd = sumyDnia(dz);
      pl.appendChild(wiersz(blysk(kto, 'pl-' + dz).trim() || null, krotkoIData(dz), null,
        'zupy ' + sd.zupy + ', drugie ' + sd.drugie + ', opakowania ' + sd.opakowania + (sd.nie.length ? ' · nie będzie: ' + sd.nie.join(', ') : ''), false));
    });
    t.push(pl);
    return t;
  }

  function widokWplat() {
    var t = [];
    t.push(el('h2', { tekst: 'Wpłaty' }));
    var oczek = stan.wplaty.filter(function (w) { return w.stan === 'zgloszona'; }).slice().reverse();
    t.push(el('h3', { tekst: 'Do odhaczenia (' + oczek.length + ')' }));
    var ul = el('ul', { klasa: 'lista' });
    oczek.forEach(function (w) {
      ul.appendChild(wiersz(blysk('szefowa', 'wpl-' + w.id).trim() || null, nazwa(w.klientId), null,
        zl(w.kwota) + ', przelew z ' + ladnaData(w.data) + ', zgłoszone ' + ladnaGodz(w.godz), false,
        [przycisk('Usuń', 'maly ostrozny', function () { usunWplate(w.id); }),
         przycisk('Przyjęte', 'maly glowny', function () { przyjmij(w.id); })]));
    });
    if (!oczek.length) ul.appendChild(pusto('Nic nie czeka.'));
    t.push(ul);
    t.push(el('p', { klasa: 'drobny', tekst: 'Wpłata liczy się od razu, gdy klient ją zgłosi. „Przyjęte”, gdy się zgadza (z księgową albo z klientem); „Usuń”, gdy wpłaty nie było — klient dostanie wiadomość.' }));

    t.push(el('h3', { tekst: 'Zapisz wpłatę (gotówka, klient bez aplikacji)' }));
    var opcje = stan.klienci.slice().sort(function (x, y) { return x.nazwa.localeCompare(y.nazwa, 'pl'); })
      .map(function (k) { return [k.id, k.nazwa]; });
    if (opcje.length) {
      t.push(el('div', { klasa: 'pola' }, [
        wybor('Klient', 'sz-klient', opcje, opcje[0][0]),
        poleKwoty('Kwota (zł)', 'sz-kwota', '250')
      ]));
      t.push(przycisk('Zapisz wpłatę', 'glowny szeroki', zapiszWplateRecznie));
      t.push(komunikat('szWplata'));
    } else {
      t.push(el('p', { klasa: 'drobny', tekst: 'Najpierw dodaj klienta w zakładce „Klienci”.' }));
    }

    // Zestawienie dla księgowości
    t.push(el('h3', { tekst: 'Zestawienie dla księgowości' }));
    var miesiace = {};
    miesiace[dzis().slice(0, 7)] = true;
    stan.wplaty.forEach(function (w) { if (w.typ !== 'start') miesiace[w.data.slice(0, 7)] = true; });
    var mOpcje = Object.keys(miesiace).sort().reverse().map(function (m) { return [m, nazwaMiesiaca(m)]; });
    if (!miesiace[ui.miesiac]) ui.miesiac = mOpcje[0][0];
    t.push(wybor('Miesiąc', 'sz-miesiac', mOpcje, ui.miesiac, function (v) { ui.miesiac = v; delete ui.info.zest; rysuj(); }));
    var lista = wplatyMiesiaca(ui.miesiac), suma = 0, przelewy = 0, gotowka = 0;
    var body = el('tbody');
    lista.forEach(function (w) {
      suma += w.kwota;
      if (w.typ === 'gotowka') gotowka += w.kwota; else przelewy += w.kwota;
      body.appendChild(el('tr', null, [
        el('td', { tekst: ladnaData(w.data) }), el('td', { tekst: nazwa(w.klientId) }),
        el('td', { klasa: 'kwota', tekst: zl(w.kwota) }), el('td', { tekst: (w.typ === 'gotowka' ? 'gotówka' : 'przelew') + (w.stan === 'zgloszona' ? ' *' : '') })
      ]));
    });
    if (!lista.length) body.appendChild(el('tr', null, [el('td', { colspan: 4, tekst: 'Brak wpłat w tym miesiącu.' })]));
    t.push(el('table', { klasa: 'zestawienie' }, [
      el('caption', { tekst: 'Wpłaty za ' + nazwaMiesiaca(ui.miesiac) + ' — ' + NAZWA_KUCHNI }),
      el('thead', null, [el('tr', null, [el('th', { tekst: 'Data' }), el('th', { tekst: 'Klient' }), el('th', { klasa: 'kwota', tekst: 'Kwota' }), el('th', { tekst: 'Sposób' })])]),
      body,
      el('tfoot', null, [el('tr', null, [el('td', { colspan: 2, tekst: 'Razem (przelewy ' + zl(przelewy) + ', gotówka ' + zl(gotowka) + ')' }), el('td', { klasa: 'kwota', tekst: zl(suma) }), el('td')])])
    ]));
    if (lista.some(function (w) { return w.stan === 'zgloszona'; })) t.push(el('p', { klasa: 'drobny', tekst: '* jeszcze nieodhaczona' }));
    t.push(el('div', { klasa: 'rzad-przyciskow' }, [przycisk('Kopiuj', '', kopiujZestawienie), przycisk('Drukuj', '', drukujZestawienie)]));
    t.push(komunikat('zest'));
    return t;
  }

  function widokKlientow() {
    var t = [];
    t.push(el('h2', { tekst: 'Klienci' }));
    if (stan.prosby.length) {
      t.push(el('h3', { tekst: 'Prośby o połączenie (' + stan.prosby.length + ')' }));
      var ul0 = el('ul', { klasa: 'lista' });
      stan.prosby.forEach(function (p) {
        var pr = 'pr-' + p.kod;
        var bezApki = stan.klienci.filter(function (k) { return !k.apka; }).map(function (k) { return [k.id, 'To jest: ' + k.nazwa]; });
        var nowy = el('div', { klasa: 'pola pelny' }, [
          pole('Jak go nazwać (widzisz tylko Ty)', pr + '-nazwa', { type: 'text', maxlength: 40, autocomplete: 'off', placeholder: 'np. Adam' }, ''),
          wybor('Grupa cenowa', pr + '-grupa', GRUPY, 'pozostali')
        ]);
        if ((ui.szkic[pr + '-kto'] || 'nowy') !== 'nowy') nowy.hidden = true;
        ul0.appendChild(el('li', { klasa: 'formularz' + blysk('szefowa', pr) }, [
          el('div', { klasa: 'kto pelny' }, [
            el('span', { klasa: 'imie' }, ['Kod ', el('span', { klasa: 'kod', tekst: p.kod })]),
            el('span', { klasa: 'meta', tekst: 'przyszła ' + ladnaData(p.data) + ' ' + ladnaGodz(p.godz) + '. Porównaj z kodem, który klient podał SMS-em albo osobiście.' })
          ]),
          el('div', { klasa: 'pelny' }, [wybor('Kto to?', pr + '-kto', [['nowy', 'Nowy klient']].concat(bezApki), 'nowy', function (v) { nowy.hidden = v !== 'nowy'; })]),
          nowy,
          el('div', { klasa: 'przyciski pelny na-prawo' }, [
            przycisk('Odrzuć', 'maly ostrozny', function () { odrzucProsbe(p.kod); }),
            przycisk('Połącz', 'maly glowny', function () { polacz(p.kod); })
          ]),
          ui.blad[pr] ? el('p', { klasa: 'komunikat blad pelny', tekst: ui.blad[pr] }) : null
        ]));
      });
      t.push(ul0);
    }

    t.push(el('h3', { tekst: 'Wszyscy (' + stan.klienci.length + ')' }));
    var ul = el('ul', { klasa: 'lista' }), d = dzis();
    stan.klienci.slice().sort(function (x, y) { return x.nazwa.localeCompare(y.nazwa, 'pl'); }).forEach(function (k) {
      var s = saldo(k.id);
      if (ui.edycja.szefowa === k.id) {
        ul.appendChild(el('li', { klasa: 'formularz' }, [
          el('span', { klasa: 'imie pelny', tekst: k.nazwa }),
          el('div', { klasa: 'pelny' }, [wybor('Grupa cenowa', 'se-grupa', GRUPY, k.grupa)]),
          k.apka ? el('p', { klasa: 'drobny pelny', tekst: 'Zamówienie ustawia klient w aplikacji: ' + opisKrotko(k.stale) + ', ' + dniOpis(k.stale.dni) + '.' })
                 : edytor('se', k.stale, true),
          el('div', { klasa: 'przyciski pelny na-prawo' }, [
            przycisk('Anuluj', 'maly', function () { edytuj('szefowa', null, 'se-'); }),
            przycisk('Zapisz', 'maly glowny', function () { zapiszKlienta(k.id); })
          ]),
          ui.blad.szEdycja ? el('p', { klasa: 'komunikat blad pelny', tekst: ui.blad.szEdycja }) : null
        ]));
        return;
      }
      ul.appendChild(wiersz(blysk('szefowa', 'kl-' + k.id).trim() || null, k.nazwa, k.apka ? 'aplikacja' : 'bez aplikacji',
        nazwaGrupy(k.grupa) + ' · ' + opisKrotko(k.stale) + ', ' + dniOpis(k.stale.dni) + ' (' + zl(cenaStala(k, d)) + ') · konto ' + zl(s), s < 0,
        [przycisk('Zmień', 'maly', function () { edytuj('szefowa', k.id, 'se-'); })]));
    });
    if (!stan.klienci.length) ul.appendChild(pusto('Jeszcze nikogo. Klient dołącza w swojej aplikacji przyciskiem „Dołącz”, a klienta bez aplikacji dodasz niżej.'));
    t.push(ul);

    t.push(el('h3', { tekst: 'Dodaj klienta bez aplikacji' }));
    t.push(el('div', { klasa: 'pola' }, [
      pole('Nazwa', 'sz-nazwa', { type: 'text', maxlength: 40, autocomplete: 'off', placeholder: 'np. Pan Józef' }, ''),
      wybor('Grupa cenowa', 'sz-grupa', GRUPY, 'pozostali'),
      poleKwoty('Stan z zeszytu (zł)', 'sz-start', '0')
    ]));
    t.push(przycisk('Dodaj klienta', 'szeroki', dodajKlienta));
    t.push(komunikat('szKlient'));
    t.push(el('p', { klasa: 'drobny', tekst: 'Nowy klient dostaje zamówienie „zupa + drugie, na miejscu, pon–pt”; zmienisz je przyciskiem „Zmień”. Klient z aplikacją sam zgłasza wpłaty i zmienia zamówienie.' }));
    return t;
  }

  function opisCennika(c) {
    return GRUPY.map(function (g) { return g[1] + ': zupa ' + zl(c.grupy[g[0]].zupa) + ', drugie ' + zl(c.grupy[g[0]].drugie); }).join('; ') +
      '; opakowanie ' + zl(c.opakowanie) + (c.opakowanieZa === 'danie' ? ' za każde danie' : ' za obiad');
  }

  function widokCennika() {
    var t = [], d = dzis(), c = cennikNa(d);
    t.push(el('h2', { tekst: 'Cennik' }));
    t.push(el('h3', { tekst: 'Obowiązuje teraz (od ' + ladnaData(c.od) + ')' }));
    var tab = el('table', { klasa: 'zestawienie cennik' }, [
      el('thead', null, [el('tr', null, [el('th', { tekst: 'Grupa' }), el('th', { klasa: 'kwota', tekst: 'Zupa' }), el('th', { klasa: 'kwota', tekst: 'Drugie' })])]),
      el('tbody', null, GRUPY.map(function (g) {
        return el('tr', null, [el('td', { tekst: g[1] }), el('td', { klasa: 'kwota', tekst: zl(c.grupy[g[0]].zupa) }), el('td', { klasa: 'kwota', tekst: zl(c.grupy[g[0]].drugie) })]);
      })),
      el('tfoot', null, [el('tr', null, [el('td', { colspan: 3, tekst: 'Opakowanie na wynos: ' + zl(c.opakowanie) + (c.opakowanieZa === 'danie' ? ' za każde danie osobno' : ' za cały obiad') })])])
    ]);
    t.push(tab);
    var przyszle = stan.cennik.filter(function (x) { return x.od > d; });
    if (przyszle.length) {
      var ul = el('ul', { klasa: 'lista' });
      przyszle.forEach(function (x) { ul.appendChild(wiersz(null, 'Od ' + ladnaData(x.od), null, opisCennika(x), false)); });
      t.push(el('h3', { tekst: 'Zapowiedziane zmiany' }), ul);
    }

    t.push(el('h3', { tekst: 'Nowy cennik' }));
    var baza = przyszle.length ? przyszle[przyszle.length - 1] : c;
    var siatka = [el('span', { klasa: 'naglowek', tekst: 'Grupa' }), el('span', { klasa: 'naglowek', tekst: 'Zupa (zł)' }), el('span', { klasa: 'naglowek', tekst: 'Drugie (zł)' })];
    GRUPY.forEach(function (g) {
      ['zupa', 'drugie'].forEach(function (co, i) {
        if (i === 0) siatka.push(el('span', { klasa: 'grupa', tekst: g[1] }));
        var id = 'cn-' + g[0] + '-' + co;
        siatka.push(el('input', { type: 'text', inputmode: 'decimal', id: id, 'aria-label': g[1] + ', ' + (co === 'zupa' ? 'zupa' : 'drugie danie'),
          value: ui.szkic[id] !== undefined ? ui.szkic[id] : zlPole(baza.grupy[g[0]][co]), wpis: function (e) { ui.szkic[id] = e.target.value; } }));
      });
    });
    t.push(el('div', { klasa: 'cennik-siatka' }, siatka));
    t.push(el('div', { klasa: 'pola' }, [
      poleKwoty('Opakowanie (zł)', 'cn-opak', zlPole(baza.opakowanie)),
      wybor('Opakowanie liczone', 'cn-za', [['obiad', 'za cały obiad'], ['danie', 'za każde danie osobno']], baza.opakowanieZa),
      pole('Obowiązuje od', 'cn-od', { type: 'date', min: d }, dodajDni(d, 1))
    ]));
    t.push(przycisk('Zapisz cennik', 'glowny szeroki', zapiszCennik));
    t.push(komunikat('cennik'));
    t.push(el('p', { klasa: 'drobny', tekst: 'Dni już naliczone zostają po starej cenie. Wpłacone pieniądze się nie zmieniają — nowa cena dotyczy kolejnych obiadów. Klienci zobaczą zapowiedź zmiany w aplikacji.' }));
    return t;
  }

  function zakladkiSzefowej() {
    var oczek = stan.wplaty.filter(function (w) { return w.stan === 'zgloszona'; }).length;
    var opcje = [['dzis', 'Dziś', 0], ['wplaty', 'Wpłaty', oczek], ['klienci', 'Klienci', stan.prosby.length], ['cennik', 'Cennik', 0]];
    return el('div', { klasa: 'zakladki', role: 'tablist' }, opcje.map(function (o) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': ui.zakladka === o[0] ? 'true' : 'false', tekst: o[1],
        klik: function () { ui.zakladka = o[0]; ui.edycja.szefowa = null; rysuj(); } });
      if (o[2]) b.appendChild(el('span', { klasa: 'znaczek', tekst: String(o[2]) }));
      return b;
    }));
  }
  function widokSzefowej() {
    var z = ui.zakladka;
    return [zakladkiSzefowej()].concat(z === 'wplaty' ? widokWplat() : z === 'klienci' ? widokKlientow() : z === 'cennik' ? widokCennika() : widokDzis('szefowa'));
  }
  function widokTelefonuKuchni() {
    return [el('p', { klasa: 'drobny nad', tekst: 'Telefon kuchni: wydawanie obiadów i odwołania przyjęte przez telefon. Wpłaty, cennik i klientów prowadzi szefowa.' })]
      .concat(widokDzis('kuchnia'));
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
  function wstaw(t, elementy) { var c = document.querySelector('#tel-' + t + ' .tresc'); c.replaceChildren.apply(c, elementy); }

  function rysuj() {
    if (zamknijDni()) zapisz();
    wstaw('klient', widokKlienta());
    wstaw('szefowa', widokSzefowej());
    wstaw('kuchnia', widokTelefonuKuchni());
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

  function odNowa(tryb) {
    stan = tryb === 'pusta' ? pustyStan() : nowyStan(tryb === 'parowanie');
    ui.szkic = {}; ui.blad = {}; ui.info = {};
    ui.zakladka = 'dzis';
    ui.edycja = { klient: null, szefowa: null };
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
  document.getElementById('od-nowa').addEventListener('click', function () { odNowa(''); });
  document.getElementById('od-nowa-parowanie').addEventListener('click', function () { odNowa('parowanie'); });
  document.getElementById('pusta').addEventListener('click', function () {
    if (window.confirm('Usunąć wszystkie dane prototypu (klientów, wpłaty, zamówienia) i zacząć od pustej kuchni?')) odNowa('pusta');
  });
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

  // Zegar „jak teraz”: co pół minuty godzina w telefonach, a o 9:00 pełne przerysowanie (naliczenie dnia).
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
