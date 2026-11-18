/* Trener czytania — wyszukiwanie liter, liczb i słów na planszy (60 s, szybkie plansze dodają czas) */
'use strict';

(() => {
  const { $, el } = T;
  const LITERY = 'ABCDEFGHIJKLMNOPRSTUWXYZ'.split('');
  // Grupy podobnych słów: cel i pułapki z tej samej grupy
  const GRUPY_SLOW = [
    ['kran', 'karp', 'krab', 'kora', 'kraj', 'kruk', 'krok', 'krem', 'kret', 'krew', 'kres', 'kopa'],
    ['woda', 'wada', 'waga', 'wata', 'waza', 'wina', 'wola', 'wozy', 'wory', 'wota', 'wiza', 'wici'],
    ['park', 'pakt', 'para', 'pary', 'paka', 'papa', 'port', 'pora', 'pory', 'post', 'prom', 'próg'],
    ['brat', 'brak', 'bram', 'baza', 'bara', 'bark', 'bary', 'baki', 'bale', 'bank', 'bant', 'bard'],
    ['staw', 'stan', 'stal', 'star', 'styk', 'stok', 'stop', 'stół', 'skok', 'skot', 'skal', 'skan'],
    ['mapa', 'masa', 'mata', 'mara', 'mała', 'maka', 'misa', 'mimo', 'mina', 'mila', 'moda', 'mowa'],
    ['traw', 'tran', 'trup', 'trud', 'trop', 'tron', 'tama', 'tara', 'taca', 'taks', 'taka', 'talk'],
    ['grad', 'gram', 'grat', 'grań', 'grab', 'gapa', 'gala', 'gaza', 'gama', 'gała', 'góra', 'góry'],
    ['drut', 'druk', 'drop', 'dres', 'domy', 'doki', 'dola', 'dama', 'data', 'dary', 'daga', 'dzik'],
    ['lato', 'lata', 'lada', 'lama', 'laga', 'lawa', 'lina', 'lipa', 'lisa', 'lisy', 'lira', 'list'],
    ['zima', 'zlot', 'złam', 'zgon', 'zbyt', 'znak', 'znój', 'zraz', 'zryw', 'zsyp', 'zupa', 'zuch'],
    ['czas', 'czar', 'czad', 'czop', 'czyn', 'czyj', 'chór', 'chód', 'chów', 'cena', 'celu', 'cech'],
    ['karta', 'karka', 'karpa', 'karma', 'karna', 'kasta', 'kasza', 'kalka', 'kawka', 'kajak', 'kawał', 'kanał'],
    ['palma', 'pałka', 'palec', 'palto', 'panna', 'panda', 'panel', 'pasek', 'pasta', 'pasaż', 'pasza', 'patyk'],
    ['skala', 'skała', 'skarb', 'skaza', 'skóra', 'sklep', 'skocz', 'stado', 'stała', 'stara', 'start', 'stary'],
    ['trawa', 'trasa', 'trata', 'tramp', 'trans', 'trakt', 'tarka', 'taras', 'taśma', 'talia', 'tanga', 'tafla'],
    ['barwa', 'barka', 'barak', 'baran', 'barok', 'bazar', 'balon', 'balet', 'banan', 'banda', 'banki', 'brama'],
    ['walka', 'walec', 'walet', 'wałek', 'warta', 'warga', 'warka', 'wazon', 'wagon', 'worek', 'wrona', 'wrota'],
    ['maska', 'maszt', 'masło', 'marka', 'marża', 'matka', 'małpa', 'miska', 'miara', 'morze', 'motyl', 'motor'],
    ['grupa', 'gruba', 'gruda', 'grunt', 'grzyb', 'grzyw', 'garda', 'garść', 'gałąź', 'gawra', 'gazik', 'grosz'],
  ];
  const CZAS_GRY = 60, MAX_BONUS = 30, PODPOWIEDZ_PO_MS = 10000, SZYBKO_S = 10, BLYSKAWICA_S = 6, NAGRODA_S = 5;

  const WARIANT = {
    litery: {
      tytul: 'Wyszukiwanie liter', etykieta: 'Znajdź literę', siatka: '7', rzecz: 'liter',
      opis: 'Na każdej planszy kilka pól ma literę pokazaną u góry. Znajdź je wszystkie, a pojawi się następna plansza.',
      porada: 'Ogarniaj wzrokiem całą planszę naraz, zamiast czytać ją wiersz po wierszu. Mała siatka i mało celów to dobry początek.',
    },
    liczby: {
      tytul: 'Wyszukiwanie liczb', etykieta: 'Znajdź liczbę', siatka: '6', rzecz: 'liczb',
      opis: 'Znajdź wszystkie liczby takie jak pokazana u góry. Pozostałe są do niej podobne: mają te same cyfry na początku albo zamienione miejscami.',
      porada: 'Patrz na całą liczbę, nie tylko na pierwsze cyfry: pułapki zaczynają się tak samo.',
    },
    slowa: {
      tytul: 'Wyszukiwanie słów', etykieta: 'Znajdź słowo', siatka: '6', rzecz: 'słów',
      opis: 'Znajdź wszystkie słowa takie jak pokazane u góry. Pozostałe różnią się od niego jedną albo dwiema literami.',
      porada: 'Szukaj kształtu słowa, a dopiero przy podobnym sprawdzaj litery. Na telefonie wygodniej na planszy 5×5 albo 6×6.',
    },
  };

  const modul = $('m-skaner');
  const plansza = $('k-plansza');
  const ramka = $('k-ramka');
  const nakladka = $('k-nakladka');
  const g = {
    wariant: 'litery', aktywna: false, n: 7, celow: 5, cel: '', grupa: -1, znalezione: 0,
    czas: CZAS_GRY, bonus: 0, wynik: 0, seria: 1, plansze: 0, bledy: 0,
    tik: 0, ostatnieTrafienie: 0, startPlanszy: 0, podpowiedz: false, zegar: null, nastepna: null,
  };
  const zapisane = () => T.stan.skaner[g.wariant];

  const losowaLiczba = () => String(1000 + T.losowa(9000));
  function pulapkaLiczby(cel, i) {
    const [a, b, c, d] = cel;
    const cyfra = () => T.losowa(10);
    let k;
    do {
      const tryb = i % 5;
      if (tryb === 0) k = `${a}${b}${cyfra()}${cyfra()}`;
      else if (tryb === 1 && b !== c) k = `${a}${c}${b}${d}`;
      else if (tryb === 2) k = `${a}${cyfra()}${cyfra()}${d}`;
      else k = losowaLiczba();
    } while (k === cel);
    return k;
  }

  function nowaPlansza() {
    const ile = g.n * g.n;
    const elementy = [];
    let cel;
    if (g.wariant === 'litery') {
      cel = T.wybierz(LITERY.filter((l) => l !== g.cel));
      const inne = LITERY.filter((l) => l !== cel);
      for (let i = g.celow; i < ile; i++) elementy.push(T.wybierz(inne));
    } else if (g.wariant === 'liczby') {
      do { cel = losowaLiczba(); } while (cel === g.cel);
      for (let i = g.celow; i < ile; i++) elementy.push(pulapkaLiczby(cel, i));
    } else {
      let nr;
      do { nr = T.losowa(GRUPY_SLOW.length); } while (nr === g.grupa);
      g.grupa = nr;
      cel = T.wybierz(GRUPY_SLOW[nr]);
      const inne = GRUPY_SLOW[nr].filter((w) => w !== cel);
      for (let i = g.celow; i < ile; i++) elementy.push(T.wybierz(inne));
    }
    for (let i = 0; i < g.celow; i++) elementy.push(cel);
    g.cel = cel;
    g.znalezione = 0;
    g.startPlanszy = performance.now();
    g.ostatnieTrafienie = g.startPlanszy;
    g.podpowiedz = false;
    T.ustawPlansze(plansza, g.n, T.tasuj(elementy));
    pokaz();
  }

  function kropki() {
    $('k-kropki').replaceChildren(...Array.from({ length: g.celow }, (_, i) => el('span', i < g.znalezione ? 'pelna' : '')));
  }

  function pokaz() {
    const z = zapisane();
    $('k-cel').textContent = g.aktywna ? g.cel : '—';
    kropki();
    $('k-czas').textContent = `${T.ulamek(Math.max(0, g.czas))} s`;
    $('k-bonus').textContent = g.bonus >= MAX_BONUS ? 'bonus wykorzystany' : `bonus +${Math.round(g.bonus)}/${MAX_BONUS} s`;
    $('k-wynik').textContent = String(g.wynik);
    $('k-seria').textContent = `seria ×${g.seria}, plansze: ${g.plansze}`;
    $('k-rekord').textContent = String(z.rekord);
    $('k-rekord-pod').textContent = `najwięcej plansz: ${z.plansze}`;
    const pasek = $('k-pasek');
    pasek.style.width = `${Math.min(100, Math.max(0, (g.czas / CZAS_GRY) * 100))}%`;
    pasek.classList.toggle('malo', g.czas <= 10);
  }

  function historia() {
    T.pokazHistorie($('k-historia'), zapisane().historia, (w) => ({
      tytul: `${w.wynik} pkt`,
      wartosc: `${w.plansze} ${T.odmiana(w.plansze, 'plansza', 'plansze', 'plansz')}`,
    }));
  }

  function zatrzymaj() {
    clearInterval(g.zegar);
    clearTimeout(g.nastepna);
    g.zegar = null;
    g.nastepna = null;
    g.aktywna = false;
  }

  function pokazNakladke(tytul, tekst, przycisk) {
    $('k-nakl-tytul').textContent = tytul;
    $('k-nakl-tekst').textContent = tekst;
    $('k-start').textContent = przycisk;
    nakladka.hidden = false;
  }

  function czytajUstawienia() {
    g.n = Number($('k-rozmiar').value) || 7;
    g.celow = Number($('k-celow').value) || 5;
  }

  function przygotuj() {
    zatrzymaj();
    czytajUstawienia();
    Object.assign(g, { czas: CZAS_GRY, bonus: 0, wynik: 0, seria: 1, plansze: 0, bledy: 0, cel: '' });
    nowaPlansza();
    pokazNakladke(WARIANT[g.wariant].tytul,
      `Na każdej planszy jest ${g.celow} ${WARIANT[g.wariant].rzecz} takich jak cel u góry. Masz 60 s; plansza ukończona w 10 s dodaje 5 s (łącznie do 30 s), pomyłka zabiera 1 s.`,
      'Start');
    pokaz();
  }

  function start() {
    zatrzymaj();
    czytajUstawienia();
    Object.assign(g, { czas: CZAS_GRY, bonus: 0, wynik: 0, seria: 1, plansze: 0, bledy: 0, aktywna: true });
    nakladka.hidden = true;
    nowaPlansza();
    g.tik = performance.now();
    g.zegar = setInterval(tik, 80);
    T.trybGry(true, modul);
  }

  function tik() {
    if (!g.aktywna) return;
    const teraz = performance.now();
    g.czas -= (teraz - g.tik) / 1000;
    g.tik = teraz;
    if (g.czas <= 0) { g.czas = 0; koniec(); return; }
    if ($('k-podpowiedz').checked && !g.podpowiedz && teraz - g.ostatnieTrafienie >= PODPOWIEDZ_PO_MS) {
      g.podpowiedz = true;
      const nieznalezione = [...plansza.querySelectorAll('.pole-planszy')].filter((p) => p.dataset.v === g.cel && !p.classList.contains('trafiony'));
      if (nieznalezione.length) T.wybierz(nieznalezione).classList.add('podpowiedz');
    }
    $('k-czas').textContent = `${T.ulamek(g.czas)} s`;
    const pasek = $('k-pasek');
    pasek.style.width = `${Math.min(100, (g.czas / CZAS_GRY) * 100)}%`;
    pasek.classList.toggle('malo', g.czas <= 10);
  }

  function planszaUkonczona() {
    g.plansze++;
    const czasPlanszy = (performance.now() - g.startPlanszy) / 1000;
    T.migniecie(ramka, 'wygrana', 280);
    if (czasPlanszy <= SZYBKO_S) {
      g.seria++;
      const zostalo = Math.max(0, MAX_BONUS - g.bonus);
      if (zostalo > 0) {
        const dodane = Math.min(NAGRODA_S, zostalo);
        g.czas = Math.min(CZAS_GRY, g.czas + dodane);
        g.bonus += dodane;
        const blyskawica = czasPlanszy <= BLYSKAWICA_S;
        const pkt = (blyskawica ? 200 : 120) * g.seria;
        g.wynik += pkt;
        T.odznaka(ramka, `${blyskawica ? 'Błyskawica' : 'Szybko'}! +${dodane} s, +${pkt} pkt`, blyskawica ? 'premia' : '');
      } else {
        const pkt = 300 * g.seria;
        g.wynik += pkt;
        T.odznaka(ramka, `Szybko! +${pkt} pkt`, 'premia');
      }
    } else {
      g.wynik += 60;
      T.odznaka(ramka, 'Plansza +60 pkt');
    }
    pokaz();
    g.nastepna = setTimeout(() => { if (g.aktywna) nowaPlansza(); }, 160);
  }

  function koniec() {
    zatrzymaj();
    const z = zapisane();
    const rekord = g.wynik > z.rekord;
    if (rekord) z.rekord = g.wynik;
    if (g.plansze > z.plansze) z.plansze = g.plansze;
    T.dopisz(z.historia, { kiedy: Date.now(), wynik: g.wynik, plansze: g.plansze, rekord });
    T.zapisz();
    pokazNakladke(rekord ? 'Nowy rekord!' : 'Koniec czasu',
      `Wynik: ${g.wynik} pkt, ${g.plansze} ${T.odmiana(g.plansze, 'plansza', 'plansze', 'plansz')}, pomyłki: ${g.bledy}.`, 'Jeszcze raz');
    T.trybGry(false, ramka);
    pokaz();
    historia();
  }

  plansza.addEventListener('click', (ev) => {
    const p = ev.target.closest('.pole-planszy');
    if (!p || !g.aktywna || p.classList.contains('trafiony')) return;
    if (p.dataset.v === g.cel) {
      p.classList.remove('podpowiedz');
      p.classList.add('trafiony');
      plansza.querySelectorAll('.podpowiedz').forEach((x) => x.classList.remove('podpowiedz'));
      g.znalezione++;
      g.ostatnieTrafienie = performance.now();
      g.podpowiedz = false;
      g.wynik += 15 * g.seria;
      if (g.znalezione >= g.celow) planszaUkonczona();
      else pokaz();
    } else {
      g.bledy++;
      g.seria = 1;
      g.czas = Math.max(0.1, g.czas - 1);
      T.migniecie(p, 'blysk-zly', 260);
      T.odznaka(ramka, 'Pomyłka: -1 s', 'kara');
      pokaz();
    }
  });
  $('k-start').addEventListener('click', start);
  $('k-rozmiar').addEventListener('change', przygotuj);
  $('k-celow').addEventListener('change', przygotuj);
  $('k-wyczysc').addEventListener('click', () => {
    if (!zapisane().historia.length && !zapisane().rekord) return;
    if (!confirm(`Usunąć wyniki i rekord: ${WARIANT[g.wariant].tytul.toLowerCase()}?`)) return;
    T.stan.skaner[g.wariant] = { rekord: 0, plansze: 0, historia: [] };
    T.zapisz();
    pokaz();
    historia();
  });

  T.moduly.skaner = {
    wejdz(nazwa) {
      g.wariant = WARIANT[nazwa] ? nazwa : 'litery';
      const w = WARIANT[g.wariant];
      $('k-tytul').textContent = w.tytul;
      $('k-opis').textContent = w.opis;
      $('k-etykieta').textContent = w.etykieta;
      $('k-porada').textContent = w.porada;
      // na wąskim telefonie słowa i liczby od 5×5, żeby dało się je przeczytać
      $('k-rozmiar').value = g.wariant !== 'litery' && window.innerWidth < 420 ? '5' : w.siatka;
      g.cel = '';
      g.grupa = -1;
      przygotuj();
      historia();
    },
    wyjdz: zatrzymaj,
    przerwij() { przygotuj(); T.trybGry(false, ramka); },
  };
})();
