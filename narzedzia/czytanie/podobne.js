/* Trener czytania — podobne zestawy: dwa zestawy na chwilę obok siebie, takie same czy różne?
   Różnice są małe: przestawione znaki (23 i 32), podobna cyfra albo litera, ogonek (rak i rąk).
   Poziom rośnie po serii dobrych odpowiedzi: zestawy są dłuższe, a pokaz krótszy. */
'use strict';

(() => {
  const { $ } = T;
  const RUND = 20, NA_AWANS = 3, MAX_POZIOM = 10, ZAKRYTE = '••••';
  const PAUZA_MS = 400, PO_ODPOWIEDZI_MS = 700, PO_BLEDZIE_MS = 1600;

  // Pary prawdziwych słów różniących się jednym szczegółem — najczęściej ogonkiem
  const PARY = [
    ['rak', 'rąk'], ['sad', 'sąd'], ['kat', 'kąt'], ['laska', 'łaska'], ['zona', 'żona'], ['moc', 'móc'],
    ['polka', 'półka'], ['gesty', 'gęsty'], ['pieta', 'pięta'], ['sol', 'sól'], ['pas', 'paś'], ['kos', 'koś'],
    ['len', 'leń'], ['mak', 'mąk'], ['kasa', 'kąsa'], ['tez', 'też'], ['bal', 'bał'], ['lawa', 'ława'],
    ['mila', 'miła'], ['was', 'wąs'], ['mąż', 'maż'], ['zebra', 'żebra'], ['woda', 'wodą'], ['ręka', 'ręką'],
    ['kasza', 'kaszą'], ['kura', 'kurą'], ['kot', 'tok'], ['byk', 'bąk'], ['lek', 'lęk'], ['waz', 'wąż'],
    ['kłos', 'kłoś'], ['zal', 'żal'], ['kon', 'koń'], ['sen', 'seń'], ['gora', 'góra'], ['wies', 'wieś'],
    ['źle', 'żle'], ['wąchać', 'wachać'], ['księga', 'księgą'], ['pociąg', 'pociag'],
  ];
  // Słowa do zmian generowanych (dużo liter, które mają odpowiednik z ogonkiem)
  const SLOWA = [
    'dom', 'kot', 'las', 'sok', 'ryba', 'mama', 'okno', 'rzeka', 'szkoła', 'książka', 'pięć', 'gęś', 'łąka', 'żółw',
    'źródło', 'mężczyzna', 'dziecko', 'miasto', 'ogród', 'świeca', 'pociąg', 'słońce', 'księżyc', 'jabłko', 'gruszka',
    'wiśnia', 'dźwięk', 'niedźwiedź', 'łódź', 'kość', 'miłość', 'zdrowie', 'podróż', 'ścieżka', 'wąwóz', 'kółko',
    'pióro', 'ołówek', 'zeszyt', 'tablica', 'krzesło', 'stół', 'ściana', 'podłoga', 'okulary', 'zegarek', 'kamień',
    'drzewo', 'liść', 'kwiat', 'trawa', 'chmura', 'deszcz', 'śnieg', 'wiatr', 'burza', 'tęcza', 'pogoda', 'jesień',
    'zima', 'wiosna', 'lato', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela',
    'tydzień', 'miesiąc', 'godzina', 'minuta', 'pamięć', 'uwaga', 'skupienie', 'czytanie', 'rozumienie', 'wiedza',
    'nauka', 'ćwiczenie', 'postęp', 'wynik', 'tempo', 'rytm', 'spokój', 'oddech', 'gałąź', 'mąka', 'ręcznik',
    'łyżka', 'widelec', 'talerz', 'szklanka', 'herbata', 'cukier', 'masło', 'ser', 'jajko', 'zupa', 'obiad',
  ];
  const OGONKI = { a: 'ą', ą: 'a', e: 'ę', ę: 'e', o: 'ó', ó: 'o', l: 'ł', ł: 'l', s: 'ś', ś: 's', c: 'ć', ć: 'c', n: 'ń', ń: 'n', z: 'ż', ż: 'z', ź: 'z' };
  const PODOBNE_LITERY = { m: 'n', n: 'm', b: 'd', d: 'b', u: 'n', c: 'e', e: 'c', a: 'o', o: 'a', i: 'l', h: 'b', t: 'f' };
  const PODOBNE_CYFRY = { 3: '8', 8: '3', 1: '7', 7: '1', 6: '8', 5: '6', 0: '8', 9: '6', 2: '7', 4: '9' };

  const modul = $('m-podobne');
  const scena = $('d-scena');
  const d = { aktywna: false, czeka: false, runda: 0, poziom: 1, seria: 0, dobre: 0, wynik: 0, najwyzszy: 1, czasy: [],
    lewy: '', prawy: '', takieSame: true, pokazano: 0, zegary: [] };
  const rodzaj = () => ($('d-rodzaj').value === 'slowa' ? 'slowa' : 'cyfry');

  function wyczyscZegary() { d.zegary.forEach(clearTimeout); d.zegary = []; }
  const pozniej = (fn, ms) => { d.zegary.push(setTimeout(fn, ms)); };

  // Poziom › długość zestawu i czas pokazu
  const dlugoscCyfr = (p) => Math.min(9, 2 + Math.floor((p - 1) * 0.7));
  const czasPokazu = (p) => Math.max(300, 2000 - (p - 1) * 190);
  const zakresSlow = (p) => (p <= 3 ? [3, 5] : p <= 6 ? [5, 7] : [7, 12]);

  // ---------- losowanie par ----------
  function przestaw(t) {
    const mozliwe = [];
    for (let i = 0; i < t.length - 1; i++) if (t[i] !== t[i + 1]) mozliwe.push(i);
    if (!mozliwe.length) return null;
    const i = T.wybierz(mozliwe);
    return t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2);
  }
  function zamienZnak(t, mapa) {
    const mozliwe = [...t].map((z, i) => (mapa[z] ? i : -1)).filter((i) => i >= 0);
    if (!mozliwe.length) return null;
    const i = T.wybierz(mozliwe);
    return t.slice(0, i) + mapa[t[i]] + t.slice(i + 1);
  }
  function paraCyfr() {
    const n = dlugoscCyfr(d.poziom);
    let a = String(1 + T.losowa(9));
    while (a.length < n) a += String(T.losowa(10));
    if (Math.random() < 0.5) return [a, a];
    let b = null;
    const los = Math.random();
    if (los < 0.6) b = przestaw(a);
    else if (los < 0.85) b = zamienZnak(a, PODOBNE_CYFRY);
    if (!b || b === a) {   // zamiana dwóch dalszych cyfr
      const i = T.losowa(n), j = (i + 1 + T.losowa(n - 1)) % n;
      const t = [...a];
      [t[i], t[j]] = [t[j], t[i]];
      b = t.join('');
    }
    if (b === a) b = zamienZnak(a, PODOBNE_CYFRY) || `${a.slice(0, -1)}${(Number(a.at(-1)) + 1) % 10}`;
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }
  function paraSlow() {
    const [od, doo] = zakresSlow(d.poziom);
    const dlugie = (s) => s.length >= od && s.length <= doo;
    const zPar = PARY.filter((p) => dlugie(p[0]));
    if (Math.random() < 0.5) {
      const s = T.wybierz(Math.random() < 0.3 && zPar.length ? zPar.flat() : SLOWA.filter(dlugie));
      return [s, s];
    }
    if (zPar.length && Math.random() < 0.4) {
      const p = T.wybierz(zPar);
      return Math.random() < 0.5 ? [p[0], p[1]] : [p[1], p[0]];
    }
    const a = T.wybierz(SLOWA.filter(dlugie));
    let b = null;
    const los = Math.random();
    if (los < 0.55) b = zamienZnak(a, OGONKI);           // ogonek: najważniejsza różnica po polsku
    else if (los < 0.8) b = przestaw(a);
    else b = zamienZnak(a, PODOBNE_LITERY);
    if (!b || b === a) b = zamienZnak(a, OGONKI) || przestaw(a) || `${a}a`;
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }

  // Oba zestawy z zaznaczonymi znakami, które się różnią (po złej odpowiedzi i przy różnych parach)
  function pokazZRoznicami(el, tekst, inny) {
    el.replaceChildren(...[...tekst].map((z, i) => {
      const s = document.createElement('span');
      s.textContent = z;
      if (z !== [...inny][i]) s.className = 'roznica';
      return s;
    }));
    el.classList.remove('zakryte');
  }
  // Ten sam rozmiar czcionki dla obu zestawów, zmniejszony, gdy dłuższy nie mieści się w pudełku (wąskie telefony)
  function dopasujCzcionke(lewy, prawy) {
    const l = $('d-lewy'), p = $('d-prawy');
    l.style.fontSize = '';
    p.style.fontSize = '';
    const bazowa = parseFloat(getComputedStyle(l).fontSize) || 24;
    const miejsce = l.clientWidth - 12;
    const szer = Math.max(T.szerokosc(lewy, bazowa, 700), T.szerokosc(prawy, bazowa, 700)) * 1.04;   // + odstępy liter
    if (miejsce > 0 && szer > miejsce) {
      const px = `${Math.max(12, Math.floor((bazowa * miejsce) / szer))}px`;
      l.style.fontSize = px;
      p.style.fontSize = px;
    }
  }
  function zestawy(lewy, prawy, zakryte) {
    if (!zakryte) dopasujCzcionke(lewy, prawy);
    $('d-lewy').textContent = lewy;
    $('d-prawy').textContent = prawy;
    $('d-lewy').classList.toggle('zakryte', zakryte);
    $('d-prawy').classList.toggle('zakryte', zakryte);
  }

  function pokaz() {
    const z = T.stan.podobne;
    const r = z.rekordy[rodzaj()];
    $('d-runda').textContent = `${d.runda} z ${RUND}`;
    $('d-seria').textContent = `seria: ${d.seria}`;
    $('d-poziom').textContent = String(d.poziom);
    $('d-poziom-pod').textContent = `pokaz ${T.ulamek(czasPokazu(d.poziom) / 1000, 1)} s`;
    $('d-wynik').textContent = String(d.wynik);
    $('d-wynik-pod').textContent = `dobrze: ${d.dobre}`;
    $('d-rekord').textContent = String(r.wynik);
    $('d-rekord-pod').textContent = `poziom: ${r.poziom}`;
  }

  function historia() {
    T.pokazHistorie($('d-historia'), T.stan.podobne.historia, (w) => ({
      tytul: `${w.rodzaj === 'slowa' ? 'Słowa' : 'Cyfry'}, poziom do ${w.poziom}`,
      wartosc: `${w.dobre} z ${w.rundy}, ${w.wynik} pkt`,
    }));
  }

  function spoczynek() {
    wyczyscZegary();
    d.aktywna = false;
    d.czeka = false;
    d.runda = 0;
    d.seria = 0;
    d.dobre = 0;
    d.wynik = 0;
    d.czasy = [];
    d.poziom = T.stan.podobne.poziom[rodzaj()];
    d.najwyzszy = d.poziom;
    $('d-odpowiedzi').hidden = true;
    $('d-start').hidden = false;
    zestawy(ZAKRYTE, ZAKRYTE, true);
    pokaz();
  }

  function start() {
    spoczynek();
    d.aktywna = true;
    $('d-start').hidden = true;
    $('d-wynik-koniec').hidden = true;
    T.trybGry(true, modul);
    nastepnaRunda();
  }

  function nastepnaRunda() {
    wyczyscZegary();
    d.runda++;
    d.czeka = false;
    [d.lewy, d.prawy] = rodzaj() === 'slowa' ? paraSlow() : paraCyfr();
    d.takieSame = d.lewy === d.prawy;
    zestawy(ZAKRYTE, ZAKRYTE, true);
    $('d-odpowiedzi').hidden = false;
    $('d-odpowiedzi').querySelectorAll('.wybor').forEach((b) => { b.disabled = true; b.classList.remove('dobry', 'zly'); });
    pokaz();
    pozniej(() => {
      zestawy(d.lewy, d.prawy, false);
      d.czeka = true;
      d.pokazano = performance.now();
      $('d-odpowiedzi').querySelectorAll('.wybor').forEach((b) => { b.disabled = false; });
      pozniej(() => { if (d.czeka) zestawy(ZAKRYTE, ZAKRYTE, true); }, czasPokazu(d.poziom));
    }, PAUZA_MS);
  }

  function odpowiedz(mowiSame) {
    if (!d.czeka) return;
    d.czeka = false;
    wyczyscZegary();
    const czas = (performance.now() - d.pokazano) / 1000;
    const dobrze = mowiSame === d.takieSame;
    const przycisk = $(mowiSame ? 'd-same' : 'd-rozne');
    $('d-odpowiedzi').querySelectorAll('.wybor').forEach((b) => { b.disabled = true; });
    przycisk.classList.add(dobrze ? 'dobry' : 'zly');
    if (dobrze) {
      d.dobre++;
      d.seria++;
      d.czasy.push(czas);
      const pkt = 10 * d.poziom;
      d.wynik += pkt;
      let tekst = `Dobrze! +${pkt} pkt`;
      if (d.seria % NA_AWANS === 0 && d.poziom < MAX_POZIOM) {
        d.poziom++;
        d.najwyzszy = Math.max(d.najwyzszy, d.poziom);
        tekst = `Poziom ${d.poziom}!`;
      }
      T.odznaka(scena, tekst);
    } else {
      d.seria = 0;
      if (d.poziom > 1) d.poziom--;
      T.odznaka(scena, d.takieSame ? 'To były takie same' : 'To były różne', 'kara');
    }
    // różne pary pokazujemy z zaznaczoną różnicą — po złej odpowiedzi dłużej
    if (d.takieSame) zestawy(d.lewy, d.prawy, false);
    else { pokazZRoznicami($('d-lewy'), d.lewy, d.prawy); pokazZRoznicami($('d-prawy'), d.prawy, d.lewy); }
    pokaz();
    pozniej(() => { if (d.runda >= RUND) koniec(); else nastepnaRunda(); }, dobrze ? PO_ODPOWIEDZI_MS : PO_BLEDZIE_MS);
  }

  function koniec() {
    d.aktywna = false;
    const z = T.stan.podobne;
    const r = z.rekordy[rodzaj()];
    const rekord = d.wynik > r.wynik;
    if (rekord) r.wynik = d.wynik;
    r.poziom = Math.max(r.poziom, d.najwyzszy);
    z.poziom[rodzaj()] = Math.max(1, d.poziom - 1);   // następna sesja zaczyna o krok niżej — na rozgrzewkę
    const sredni = d.czasy.length ? d.czasy.reduce((a, x) => a + x, 0) / d.czasy.length : 0;
    T.dopisz(z.historia, { kiedy: Date.now(), rodzaj: rodzaj(), rundy: RUND, dobre: d.dobre, poziom: d.najwyzszy, wynik: d.wynik, rekord });
    T.zapisz();
    const w = $('d-wynik-koniec');
    w.textContent = `${rekord ? 'Nowy rekord! ' : ''}Dobrze ${d.dobre} z ${RUND}, najwyższy poziom ${d.najwyzszy}, punkty ${d.wynik}`
      + `${sredni ? `, średnio ${T.ulamek(sredni, 2)} s na odpowiedź` : ''}. Następna sesja zacznie od poziomu ${z.poziom[rodzaj()]}.`;
    w.hidden = false;
    const wynik = d.wynik, dobre = d.dobre;
    spoczynek();
    d.wynik = wynik;
    d.dobre = dobre;
    pokaz();
    T.trybGry(false, scena);
    historia();
  }

  $('d-start').addEventListener('click', start);
  $('d-same').addEventListener('click', () => odpowiedz(true));
  $('d-rozne').addEventListener('click', () => odpowiedz(false));
  document.addEventListener('keydown', (ev) => {
    if (modul.hidden || !d.czeka || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); odpowiedz(true); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); odpowiedz(false); }
  });
  $('d-rodzaj').addEventListener('change', () => { $('d-wynik-koniec').hidden = true; spoczynek(); });
  $('d-wyczysc').addEventListener('click', () => {
    const z = T.stan.podobne;
    if (!z.historia.length && !z.rekordy.cyfry.wynik && !z.rekordy.slowa.wynik) return;
    if (!confirm('Usunąć wyniki, rekordy i poziomy ćwiczenia z podobnymi zestawami?')) return;
    T.stan.podobne = T.domyslny().podobne;
    T.zapisz();
    spoczynek();
    historia();
  });

  T.moduly.podobne = {
    wejdz() { $('d-wynik-koniec').hidden = true; spoczynek(); historia(); },
    wyjdz() { wyczyscZegary(); d.aktywna = false; d.czeka = false; },
    przerwij() { spoczynek(); T.trybGry(false, scena); },
  };
})();
