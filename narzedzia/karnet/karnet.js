// Karnet — licznik przedpłat. Solutor (solutor.pl/narzedzia/karnet/).
// Dane wyłącznie w localStorage tej przeglądarki; nic nie jest wysyłane.
// Wszystko, co pochodzi od użytkownika (nazwa, notatki, wklejony kod, plik), trafia na stronę
// jako tekst (textContent), nigdy jako HTML — wklejony cudzy kod nie może uruchomić skryptu.
'use strict';

const KLUCZ = 'solutor.karnet.v1';      // własny prefiks: inne narzędzia na solutor.pl mają swoje klucze
const MAX_WPISOW = 5000;
const MAX_KWOTA = 100000;
const MAX_ILE = 500;
const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const ZL = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ZL0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

let stan = { nazwa: '', wpisy: [] };

const $ = (id) => document.getElementById(id);

// ---------- pomocnicze ----------
function dzis() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function poprawnaData(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [r, m, d] = s.split('-').map(Number);
  const t = new Date(r, m - 1, d);
  return t.getFullYear() === r && t.getMonth() === m - 1 && t.getDate() === d && r >= 2000 && r <= 2100;
}
function dataKrotka(s) { const [, m, d] = s.split('-'); return `${d}.${m}`; }
function dataPelna(s) {
  const [r, m, d] = s.split('-');
  return `${d}.${m}.${r} (${DNI[new Date(+r, +m - 1, +d).getDay()]})`;
}
function zl(x) { return `${ZL.format(x)} zł`; }
function nowyId() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function el(tag, klasa, tekst) {
  const e = document.createElement(tag);
  if (klasa) e.className = klasa;
  if (tekst !== undefined) e.textContent = tekst;
  return e;
}
function razy(n) {
  // „1 raz”, „2 razy”, „5 razy”
  return n === 1 ? '1 raz' : `${n} razy`;
}
function wpisow(n) {
  const d = n % 10, s = n % 100;
  if (n === 1) return '1 wpis';
  return (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) ? `${n} wpisy` : `${n} wpisów`;
}

// ---------- sprawdzanie danych z zewnątrz (plik, wklejony kod, pamięć przeglądarki) ----------
function oczyscWpis(w, kiedyZapas) {
  if (!w || typeof w !== 'object') return null;
  const typ = w.typ;
  if (!poprawnaData(w.data)) return null;
  const kiedy = Number.isFinite(w.kiedy) ? w.kiedy : kiedyZapas;
  if (typ === 'wplata') {
    const kwota = Math.round(Number(w.kwota) * 100) / 100;
    const ile = Number(w.ile);
    if (!Number.isFinite(kwota) || kwota <= 0 || kwota > MAX_KWOTA) return null;
    if (!Number.isInteger(ile) || ile < 1 || ile > MAX_ILE) return null;
    return { id: nowyId(), typ, data: w.data, kwota, ile, notatka: '', kiedy };
  }
  if (typ === 'uzycie') {
    const notatka = typeof w.notatka === 'string' ? w.notatka.slice(0, 80) : '';
    return { id: nowyId(), typ, data: w.data, kwota: 0, ile: 1, notatka, kiedy };
  }
  return null;
}
function oczyscStan(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.wpisy) || s.wpisy.length > MAX_WPISOW) return null;
  const baza = Date.now() - s.wpisy.length;
  const wpisy = [];
  for (let i = 0; i < s.wpisy.length; i++) {
    const w = oczyscWpis(s.wpisy[i], baza + i);
    if (w) wpisy.push(w);
  }
  const nazwa = typeof s.nazwa === 'string' ? s.nazwa.slice(0, 60) : '';
  return { nazwa, wpisy, odrzucone: s.wpisy.length - wpisy.length };
}
// Plik kopii z pierwszej wersji (Karnet Obiadowy): { transactions: [{type, date, amount, meals, note, createdAt}] }
function zeStaregoFormatu(o) {
  if (!o || !Array.isArray(o.transactions)) return null;
  return {
    nazwa: 'Obiady',
    wpisy: o.transactions.map((t) => (t && {
      typ: t.type === 'payment' ? 'wplata' : t.type === 'pickup' ? 'uzycie' : '?',
      data: t.date, kwota: t.amount, ile: t.meals, notatka: t.note, kiedy: t.createdAt,
    })),
  };
}

// ---------- pamięć przeglądarki ----------
function wczytajPamiec() {
  try {
    const surowe = localStorage.getItem(KLUCZ);
    if (!surowe) return;
    const s = oczyscStan(JSON.parse(surowe));
    if (s) stan = { nazwa: s.nazwa, wpisy: s.wpisy };
  } catch (e) {
    komunikat('Nie udało się odczytać zapisanego karnetu.', true);
  }
}
function zapisz() {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify({ v: 1, nazwa: stan.nazwa, wpisy: stan.wpisy }));
  } catch (e) {
    komunikat('Przeglądarka nie pozwala zapisywać danych (tryb prywatny?). Zapisz kopię do pliku.', true);
  }
  pokaz();
}

// ---------- rozliczenie ----------
const poKolei = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.kiedy - b.kiedy);

function rozlicz() {
  const wplaty = stan.wpisy.filter((w) => w.typ === 'wplata').sort(poKolei);
  const uzycia = stan.wpisy.filter((w) => w.typ === 'uzycie').sort(poKolei);
  const kupione = wplaty.reduce((a, w) => a + w.ile, 0);
  const zaplacone = wplaty.reduce((a, w) => a + w.kwota, 0);
  const zuzyte = uzycia.length;
  const zostalo = kupione - zuzyte;

  // Wykorzystania „zjadają” wpłaty po kolei (najstarsza pierwsza) — każda wpłata ma swoją cenę.
  let doRozdzialu = zuzyte;
  let wartosc = 0;
  let poczatek = 0;
  const pule = wplaty.map((w) => {
    const cena = w.kwota / w.ile;
    const uzyte = Math.min(w.ile, Math.max(0, doRozdzialu));
    doRozdzialu -= uzyte;
    wartosc += (w.ile - uzyte) * cena;
    const p = { wplata: w, cena, uzyte, wolne: w.ile - uzyte, poczatek };
    poczatek += uzyte;
    return p;
  });
  const ostatnia = wplaty[wplaty.length - 1];
  const cenaOstatnia = ostatnia ? ostatnia.kwota / ostatnia.ile : 0;
  if (zostalo < 0) wartosc = zostalo * cenaOstatnia;   // na minusie: ile trzeba dopłacić po ostatniej cenie
  return { wplaty, uzycia, kupione, zaplacone, zuzyte, zostalo, wartosc, pule, cenaOstatnia };
}

// ---------- widok ----------
function pokaz() {
  const r = rozlicz();
  document.title = stan.nazwa ? `Karnet: ${stan.nazwa} — Solutor` : 'Karnet — licznik przedpłat — Solutor';
  if (document.activeElement !== $('nazwa')) $('nazwa').value = stan.nazwa;
  $('nazwa-druk').textContent = stan.nazwa ? `Karnet: ${stan.nazwa}` : 'Karnet';

  $('zostalo').textContent = String(r.zostalo);
  $('zostalo-pod').textContent = r.kupione ? `wykorzystano ${r.zuzyte} z ${r.kupione}` : 'brak wpłat';
  $('wartosc').textContent = `${ZL0.format(Math.round(Math.abs(r.wartosc)))} zł`;
  $('wartosc-pod').textContent = r.zostalo < 0
    ? 'tyle do dopłaty (po ostatniej cenie)'
    : (r.cenaOstatnia ? `ostatnia cena: ${zl(r.cenaOstatnia)} za raz` : ' ');
  document.querySelector('.saldo').classList.toggle('minus', r.zostalo < 0);

  pokazKafelki(r);
  pokazHistorie();
}

function pokazKafelki(r) {
  const box = $('kafelki');
  box.replaceChildren();
  const opis = $('pula-opis');
  if (!r.pule.length) {
    opis.textContent = '';
    box.append(el('div', 'pusto', 'Brak wpłat. Dodaj pierwszą wpłatę poniżej albo wczytaj stan z innego urządzenia.'));
    return;
  }
  let widoczne = r.pule.filter((p) => p.wolne > 0);
  if (!widoczne.length) widoczne = [r.pule[r.pule.length - 1]];
  const ost = widoczne[widoczne.length - 1].wplata;
  opis.textContent = widoczne.length === 1
    ? `wpłata z ${dataKrotka(ost.data)}: ${zl(ost.kwota)} za ${razy(ost.ile)}`
    : `${widoczne.length} wpłaty w puli, ostatnia z ${dataKrotka(ost.data)}`;

  let nr = 1;
  for (const p of widoczne) {
    for (let i = 0; i < p.wplata.ile; i++, nr++) {
      if (i < p.uzyte) {
        const u = r.uzycia[p.poczatek + i];
        const k = el('div', 'kafelek zuzyty');
        k.title = `Wykorzystano ${dataPelna(u.data)}${u.notatka ? ': ' + u.notatka : ''}`;
        k.append(el('span', 'nr', `#${nr}`), el('span', 'stan', `✓ ${dataKrotka(u.data)}`));
        box.append(k);
      } else {
        const k = el('button', 'kafelek');
        k.type = 'button';
        k.title = 'Wykorzystaj (data z pola „Data” poniżej)';
        k.append(el('span', 'nr', `#${nr}`), el('span', 'stan', 'wolny'));
        k.addEventListener('click', odhacz);
        box.append(k);
      }
    }
  }
  if (r.zostalo < 0) box.append(el('div', 'pusto', `Na minusie: ${-r.zostalo}. Dodaj wpłatę, a wykorzystania rozliczą się same.`));
}

function pokazHistorie() {
  const lista = $('historia');
  lista.replaceChildren();
  $('historia-liczba').textContent = stan.wpisy.length ? wpisow(stan.wpisy.length) : '';
  if (!stan.wpisy.length) {
    lista.append(el('li', 'pusto', 'Historia jest pusta.'));
    return;
  }
  const kolejnosc = [...stan.wpisy].sort((a, b) => -poKolei(a, b));
  for (const w of kolejnosc) {
    const li = el('li', w.typ === 'wplata' ? 'wplata' : '');
    const opis = el('div', 'opis');
    if (w.typ === 'wplata') {
      opis.append(
        el('span', 'tytul', `Wpłata ${zl(w.kwota)} za ${razy(w.ile)}`),
        el('span', 'meta', `${dataPelna(w.data)} · ${zl(w.kwota / w.ile)} za raz`),
      );
    } else {
      opis.append(
        el('span', 'tytul', w.notatka ? `Wykorzystano 1 — ${w.notatka}` : 'Wykorzystano 1'),
        el('span', 'meta', dataPelna(w.data)),
      );
    }
    const b = el('button', 'przycisk maly bez-druku', w.typ === 'wplata' ? 'Usuń' : 'Cofnij');
    b.type = 'button';
    b.addEventListener('click', () => usun(w.id));
    li.append(opis, b);
    lista.append(li);
  }
}

let zegarKomunikatu = 0;
function komunikat(tekst, blad = false) {
  const k = $('komunikat');
  k.textContent = tekst;
  k.classList.toggle('blad', blad);
  clearTimeout(zegarKomunikatu);
  zegarKomunikatu = setTimeout(() => { k.textContent = ''; }, 6000);
}

// ---------- działania ----------
function odhacz() {
  const r = rozlicz();
  const data = poprawnaData($('odhacz-data').value) ? $('odhacz-data').value : dzis();
  if (stan.wpisy.some((w) => w.typ === 'uzycie' && w.data === data)
      && !confirm(`${dataPelna(data)} ma już wykorzystanie. Zapisać kolejne tego samego dnia?`)) return;
  if (r.zostalo <= 0 && !confirm('W karnecie nic nie zostało. Wykorzystać na minus (rozliczy się przy następnej wpłacie)?')) return;
  stan.wpisy.push({
    id: nowyId(), typ: 'uzycie', data, kwota: 0, ile: 1,
    notatka: $('odhacz-notatka').value.trim().slice(0, 80), kiedy: Date.now(),
  });
  $('odhacz-notatka').value = '';
  zapisz();
}

function wplac() {
  const kwota = Math.round(parseFloat(String($('wplata-kwota').value).replace(',', '.')) * 100) / 100;
  const ile = Number($('wplata-ile').value);
  const data = poprawnaData($('wplata-data').value) ? $('wplata-data').value : dzis();
  if (!Number.isFinite(kwota) || kwota <= 0 || kwota > MAX_KWOTA) { komunikatPola('Podaj kwotę wpłaty (np. 250).'); return; }
  if (!Number.isInteger(ile) || ile < 1 || ile > MAX_ILE) { komunikatPola('Podaj, za ile razy jest wpłata (liczba całkowita, np. 10).'); return; }
  stan.wpisy.push({ id: nowyId(), typ: 'wplata', data, kwota, ile, notatka: '', kiedy: Date.now() });
  zapisz();
}
function komunikatPola(t) { alert(t); }

function usun(id) {
  const w = stan.wpisy.find((x) => x.id === id);
  if (!w) return;
  const pytanie = w.typ === 'wplata'
    ? `Usunąć wpłatę ${zl(w.kwota)} z ${dataPelna(w.data)}?`
    : `Cofnąć wykorzystanie z ${dataPelna(w.data)}?`;
  if (!confirm(pytanie)) return;
  stan.wpisy = stan.wpisy.filter((x) => x.id !== id);
  zapisz();
}

// ---------- przenoszenie stanu: krótki kod w wiadomości ----------
// KP1|N~<nazwa>|P~<data>~<kwota>~<ile>|U~<data>~<notatka>  (nazwa i notatki zakodowane, bez spacji)
const zakoduj = (t) => encodeURIComponent(t).replace(/~/g, '%7E');

function kod() {
  const czesci = ['KP1', `N~${zakoduj(stan.nazwa)}`];
  for (const w of [...stan.wpisy].sort(poKolei)) {
    czesci.push(w.typ === 'wplata' ? `P~${w.data}~${w.kwota}~${w.ile}` : `U~${w.data}~${zakoduj(w.notatka)}`);
  }
  return czesci.join('|');
}

function odczytajKod(tekst) {
  const m = String(tekst || '').match(/K[OP]1\|\S+/);   // KO1 — kod z pierwszej wersji (Karnet Obiadowy)
  if (!m) return null;
  if (m[0] === 'KO1|EMPTY') return oczyscStan({ nazwa: 'Obiady', wpisy: [] });
  const czesci = m[0].split('|');
  const stary = czesci[0] === 'KO1';
  let nazwa = stary ? 'Obiady' : '';
  const wpisy = [];
  const baza = Date.now() - czesci.length;
  for (let i = 1; i < czesci.length && wpisy.length <= MAX_WPISOW; i++) {
    const f = czesci[i].split('~');
    let tekstPola = '';
    try { tekstPola = f[2] ? decodeURIComponent(f[2]) : ''; } catch (e) { tekstPola = ''; }
    if (f[0] === 'N') {
      try { nazwa = decodeURIComponent(f[1] || ''); } catch (e) { nazwa = ''; }
    } else if (f[0] === 'P') {
      wpisy.push({ typ: 'wplata', data: f[1], kwota: parseFloat(f[2]), ile: Number(f[3]), kiedy: baza + i });
    } else if (f[0] === 'U') {
      wpisy.push({ typ: 'uzycie', data: f[1], notatka: tekstPola, kiedy: baza + i });
    }
  }
  return oczyscStan({ nazwa, wpisy });
}

function streszczenie(s) {
  const zapas = stan;
  stan = s;
  const r = rozlicz();
  stan = zapas;
  return `${s.nazwa ? '„' + s.nazwa + '”: ' : ''}${wpisow(s.wpisy.length)}, zostało ${r.zostalo}`;
}

function zastap(nowy, skad) {
  if (stan.wpisy.length && !confirm(
    `Zastąpić obecny karnet (${streszczenie(stan)}) karnetem ${skad} (${streszczenie(nowy)})?\n\nObecnych wpisów nie da się potem przywrócić.`)) return;
  stan = { nazwa: nowy.nazwa, wpisy: nowy.wpisy };
  zapisz();
  komunikat(`Wczytano: ${streszczenie(stan)}${nowy.odrzucone ? ` (pominięto błędne wpisy: ${nowy.odrzucone})` : ''}.`);
}

async function wyslij() {
  const r = rozlicz();
  const tekst = `Karnet${stan.nazwa ? ' „' + stan.nazwa + '”' : ''}: zostało ${r.zostalo} z ${r.kupione}. `
    + `Żeby wczytać: solutor.pl/narzedzia/karnet › „Wczytaj stan”.\n${kod()}`;
  if (navigator.share) {
    try { await navigator.share({ text: tekst }); return; } catch (e) {
      if (e && e.name === 'AbortError') return;   // użytkownik zamknął okno udostępniania
    }
  }
  try {
    await navigator.clipboard.writeText(tekst);
    komunikat('Skopiowano. Wklej to sobie np. w notatce albo na Messengerze.');
  } catch (e) {
    komunikat('Przeglądarka nie pozwoliła skopiować. Użyj „Zapisz kopię do pliku”.', true);
  }
}

async function wczytaj() {
  let tekst;
  try {
    tekst = await navigator.clipboard.readText();
  } catch (e) {
    komunikat('Przeglądarka nie pozwoliła odczytać schowka. Zezwól na wklejanie albo użyj „Wczytaj kopię z pliku”.', true);
    return;
  }
  const nowy = odczytajKod(tekst);
  if (!nowy) { komunikat('W schowku nie ma kodu karnetu. Skopiuj całą wiadomość z kodem i spróbuj jeszcze raz.', true); return; }
  zastap(nowy, 'ze schowka');
}

// ---------- kopia w pliku ----------
function zapiszPlik() {
  const dane = JSON.stringify({ aplikacja: 'solutor-karnet', v: 1, nazwa: stan.nazwa, wpisy: stan.wpisy }, null, 2);
  const url = URL.createObjectURL(new Blob([dane], { type: 'application/json' }));
  const a = el('a');
  const nazwaPliku = (stan.nazwa || 'karnet').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'karnet';
  a.href = url;
  a.download = `karnet-${nazwaPliku}-${dzis()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  komunikat('Kopia zapisana w pobranych plikach.');
}

function wczytajPlik(ev) {
  const plik = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!plik) return;
  if (plik.size > 2 * 1024 * 1024) { komunikat('To nie jest plik kopii karnetu (za duży).', true); return; }
  const czytnik = new FileReader();
  czytnik.onload = () => {
    let o;
    try { o = JSON.parse(czytnik.result); } catch (e) { komunikat('Nie udało się odczytać pliku: to nie jest kopia karnetu.', true); return; }
    const nowy = oczyscStan(Array.isArray(o && o.transactions) ? zeStaregoFormatu(o) : o);
    if (!nowy) { komunikat('Nieznany format pliku: to nie jest kopia karnetu.', true); return; }
    zastap(nowy, 'z pliku');
  };
  czytnik.readAsText(plik);
}

function wyczysc() {
  if (!stan.wpisy.length && !stan.nazwa) return;
  if (!confirm(`Wyczyścić karnet (${streszczenie(stan)})? Tego nie da się cofnąć — jeśli chcesz, najpierw zapisz kopię do pliku.`)) return;
  stan = { nazwa: '', wpisy: [] };
  try { localStorage.removeItem(KLUCZ); } catch (e) { /* nic */ }
  pokaz();
  komunikat('Karnet wyczyszczony.');
}

// ---------- start ----------
document.addEventListener('DOMContentLoaded', () => {
  wczytajPamiec();
  $('odhacz-data').value = dzis();
  $('wplata-data').value = dzis();
  const r = rozlicz();
  const ost = r.wplaty[r.wplaty.length - 1];
  if (ost) { $('wplata-kwota').value = ost.kwota; $('wplata-ile').value = ost.ile; }

  let zegarNazwy = 0;
  $('nazwa').addEventListener('input', () => {
    clearTimeout(zegarNazwy);
    zegarNazwy = setTimeout(() => { stan.nazwa = $('nazwa').value.trim().slice(0, 60); zapisz(); }, 400);
  });
  $('nazwa').addEventListener('change', () => { stan.nazwa = $('nazwa').value.trim().slice(0, 60); zapisz(); });
  $('odhacz').addEventListener('click', odhacz);
  $('wplac').addEventListener('click', wplac);
  $('wyslij').addEventListener('click', wyslij);
  $('wczytaj').addEventListener('click', wczytaj);
  $('zapisz-plik').addEventListener('click', zapiszPlik);
  $('wczytaj-plik').addEventListener('click', () => $('plik').click());
  $('plik').addEventListener('change', wczytajPlik);
  $('drukuj').addEventListener('click', () => window.print());
  $('wyczysc').addEventListener('click', wyczysc);
  pokaz();
});
