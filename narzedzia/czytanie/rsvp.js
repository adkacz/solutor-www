/* Trener czytania — RSVP: tekst po jednym słowie (albo po kilka) w stałym miejscu, z literą skupienia (ORP).
   Tu też wybór tekstu (wbudowane albo „Moje teksty”, moje.js); z wybranego tekstu korzysta ćwiczenie „Pojęcia”
   (T.biezacyTekst). Nazwy i treści tylko przez textContent. */
'use strict';

(() => {
  const { $, el } = T;
  const TEKSTY = [
    {
      nazwa: 'Jak czytają oczy',
      tresc: 'Podczas czytania oczy nie suną płynnie po linijce. Wykonują krótkie skoki, nazywane sakadami, a między nimi zatrzymują się na ułamek sekundy. W czasie takiego zatrzymania, czyli fiksacji, odczytujemy zwykle jedno słowo i fragment następnego. Krótkie wyrazy, takie jak spójniki, często przeskakujemy, a dłuższe i rzadziej spotykane oglądamy dłużej. Co kilka zdań wzrok cofa się też do miejsca, które wymaga sprawdzenia. Te powroty nie są błędem: pomagają złożyć sens zdania, zwłaszcza gdy tekst jest trudny. Pokazywanie tekstu słowo po słowie w jednym punkcie ekranu usuwa skoki oczu, ale usuwa też możliwość powrotu. Przy umiarkowanym tempie czyta się w ten sposób wygodnie. Przy bardzo wysokim tempie słowa wciąż da się rozpoznać, jednak coraz trudniej połączyć je w całość i zapamiętać. Dlatego warto co jakiś czas zatrzymać się i sprawdzić, co z przeczytanego fragmentu zostało w głowie. Prawdziwą miarą czytania nie jest liczba słów na minutę, tylko to, ile z tekstu rozumiemy.',
    },
    {
      nazwa: 'Uwaga przy czytaniu',
      tresc: 'Uwaga działa jak reflektor: oświetla jedną rzecz, a resztę zostawia w półmroku. Kiedy czytamy, ten reflektor co chwilę ucieka w stronę telefonu, rozmowy za ścianą albo własnych myśli. Każdy taki odskok kosztuje kilka sekund powrotu do tekstu i często zgubienie wątku. Wprawni czytelnicy nie mają lepszych oczu, tylko lepiej przygotowane warunki i jasny cel. Zanim zaczną, przeglądają tytuły, śródtytuły i wyróżnienia, żeby wiedzieć, czego szukać. Podczas lektury zadają sobie pytania i sprawdzają, czy tekst na nie odpowiada. Po skończeniu streszczają najważniejsze myśli własnymi słowami. Pomaga też dzielenie pracy na krótkie odcinki z przerwami, bo zmęczenie szybko obniża jakość skupienia. Ćwiczenia wzrokowe, takie jak wyszukiwanie znaków na planszy, uczą sprawnego przeszukiwania i utrzymania koncentracji przez krótki czas. Nie zastąpią jednak znajomości tematu ani bogatego słownictwa. Im więcej wiemy o danej dziedzinie, tym szybciej czytamy teksty, które jej dotyczą, bo wiele informacji rozpoznajemy od razu.',
    },
    {
      nazwa: 'Skąd się bierze siła nośna',
      tresc: 'Na samolot w locie działają cztery siły: ciężar, siła nośna, ciąg silników i opór powietrza. Siła nośna powstaje dzięki kształtowi skrzydła i jego ustawieniu względem napływającego powietrza. Skrzydło odchyla strumień powietrza w dół, a zgodnie z trzecią zasadą dynamiki powietrze odpycha skrzydło w górę. Jednocześnie nad górną powierzchnią powietrze płynie szybciej i ma niższe ciśnienie niż pod spodem. Oba opisy dotyczą tego samego zjawiska i prowadzą do zgodnych wyników. Ważnym parametrem jest kąt natarcia, czyli kąt między skrzydłem a kierunkiem napływu. Gdy rośnie, rośnie też siła nośna, ale tylko do pewnej granicy. Po jej przekroczeniu strumień odrywa się od górnej powierzchni, siła nośna gwałtownie spada i dochodzi do przeciągnięcia. Dlatego przy lądowaniu, gdy prędkość jest mała, piloci wysuwają klapy. Zwiększają one powierzchnię i wygięcie skrzydła, co pozwala utrzymać samolot w powietrzu przy mniejszej prędkości i bezpieczniejszym kącie natarcia.',
    },
  ];
  const MAX_TEMPO = 1200;

  const modul = $('m-rsvp');
  const scena = $('r-scena');
  const r = { slowa: [], i: 0, bazowe: 350, tempo: 350, porcja: 1, przyspieszaj: true, sesja: false, gra: false, startGry: 0, czasGry: 0, zegar: null };

  const mojTekst = () => T.stan.tekst.moje.find((m) => m.id === T.stan.tekst.wybor);
  function biezacyTekst() {
    const t = T.stan.tekst;
    const m = mojTekst();
    if (m) return { nazwa: `„${m.nazwa}”`, tresc: m.tresc };
    const p = TEKSTY[Number(t.wybor)] || TEKSTY[0];
    return { nazwa: `„${p.nazwa}”`, tresc: p.tresc };
  }
  T.biezacyTekst = biezacyTekst;

  // Listy wyboru tekstu (tu i w „Pojęciach”): wbudowane i „Moje teksty”
  const WYBORY = ['r-wybor-tekstu', 'j-wybor-tekstu'];
  function odswiezWybory() {
    for (const id of WYBORY) {
      const s = $(id);
      if (!s) continue;
      s.replaceChildren();
      TEKSTY.forEach((t, i) => { const o = el('option', '', t.nazwa); o.value = String(i); s.append(o); });
      if (T.stan.tekst.moje.length) {
        const grupa = document.createElement('optgroup');
        grupa.label = 'Moje teksty';
        for (const m of T.stan.tekst.moje) { const o = el('option', '', m.nazwa); o.value = m.id; grupa.append(o); }
        s.append(grupa);
      }
      s.value = T.stan.tekst.wybor;
    }
  }
  function wybierzTekst(wybor) {
    const ok = TEKSTY[Number(wybor)] || T.stan.tekst.moje.some((m) => m.id === wybor);
    T.stan.tekst.wybor = ok ? wybor : '0';
    T.zapisz();
    odswiezWybory();
  }
  T.odswiezWyboryTekstu = odswiezWybory;
  T.wybierzTekst = wybierzTekst;

  // Litera skupienia: lekko na lewo od środka słowa
  function orp(dl) {
    if (dl <= 1) return 0;
    if (dl <= 5) return 1;
    if (dl <= 9) return 2;
    if (dl <= 13) return 3;
    return Math.floor(dl * 0.35);
  }

  function pokazSlowo() {
    const box = $('r-slowo');
    let lewa = '', srodek = '', prawa = '';
    if (!r.slowa.length) {
      prawa = '';
    } else {
      const od = Math.min(r.i, r.slowa.length - 1);
      const kawalek = r.slowa.slice(od, od + r.porcja).join(' ');
      let k = r.porcja > 1 ? Math.floor(kawalek.length / 2) : orp(kawalek.length);
      if (kawalek[k] === ' ') k++;
      lewa = kawalek.slice(0, k);
      srodek = kawalek[k] || '';
      prawa = kawalek.slice(k + 1);
    }
    // Rozmiar: im węższy ekran, tym mniejszy; długie słowo albo kilka słów — zmniejszone tak, żeby się zmieściło
    const dostepne = scena.clientWidth - 24;
    if (dostepne > 0) {
      let px = Math.min(44, Math.max(24, dostepne * 0.085));
      const potrzeba = 2 * Math.max(T.szerokosc(lewa, px), T.szerokosc(prawa, px)) + T.szerokosc(srodek, px);
      if (potrzeba > dostepne) px = Math.max(12, Math.floor((px * dostepne) / potrzeba));
      box.style.fontSize = `${px}px`;
    }
    $('r-lewa').textContent = lewa;
    $('r-orp').textContent = srodek;
    $('r-prawa').textContent = prawa;
  }

  function pokaz() {
    const ile = r.slowa.length;
    const zrobione = Math.min(r.i, ile);
    const proc = ile ? Math.round((zrobione / ile) * 100) : 0;
    $('r-tempo').textContent = String(r.tempo);
    $('r-tempo-pod').textContent = r.przyspieszaj ? 'słów/min, rośnie' : 'słów/min, stałe';
    $('r-postep').textContent = `${proc}%`;
    $('r-postep-pod').textContent = `${zrobione} z ${ile}`;
    $('r-zostalo').textContent = `${Math.round(((ile - zrobione) / r.tempo) * 60)} s`;
    $('r-rekord').textContent = String(T.stan.rsvp.rekord);
    $('r-pasek').style.width = `${proc}%`;
    $('r-graj').textContent = r.gra ? 'Pauza' : (r.sesja ? 'Wznów' : 'Start');
    $('r-graj').disabled = !ile;
    $('r-wstecz').disabled = !ile;
  }

  function historia() {
    T.pokazHistorie($('r-historia'), T.stan.rsvp.historia, (w) => ({
      tytul: `${w.slowa} ${T.odmiana(w.slowa, 'słowo', 'słowa', 'słów')}`,
      wartosc: `${w.tempo} słów/min`,
    }));
  }

  function czytajUstawienia() {
    r.bazowe = Number($('r-tempo-wybor').value) || 350;
    r.porcja = Math.min(3, Math.max(1, Number($('r-porcja').value) || 1));
    r.przyspieszaj = $('r-przyspieszaj').checked;
    if (!r.sesja) r.tempo = r.bazowe;
  }

  function zaladujTekst() {
    const t = biezacyTekst();
    r.slowa = t.tresc.trim() ? t.tresc.trim().split(/\s+/) : [];
    $('r-wybor-tekstu').value = T.stan.tekst.wybor;
    odNowa();
  }

  function pauza() {
    clearTimeout(r.zegar);
    r.zegar = null;
    if (r.gra) r.czasGry += performance.now() - r.startGry;
    r.gra = false;
    pokaz();
  }

  function graj() {
    if (r.gra) { pauza(); return; }
    if (!r.slowa.length) return;
    if (!r.sesja) {
      czytajUstawienia();
      r.sesja = true;
      r.i = 0;
      r.czasGry = 0;
      r.tempo = r.bazowe;
      $('r-wynik').hidden = true;
      T.trybGry(true, modul);
    }
    r.gra = true;
    r.startGry = performance.now();
    krok();
  }

  function krok() {
    if (!r.gra) return;
    pokazSlowo();
    const sekundy = (r.czasGry + performance.now() - r.startGry) / 1000;
    r.tempo = r.przyspieszaj ? Math.min(MAX_TEMPO, r.bazowe + Math.floor(sekundy / 10) * 25) : r.bazowe;
    pokaz();
    const kawalek = r.slowa.slice(r.i, r.i + r.porcja).join(' ');
    let ms = (60000 / r.tempo) * r.porcja;
    if (/[.!?…]["”»)]*$/.test(kawalek)) ms *= 1.55;   // chwila oddechu na końcu zdania
    r.zegar = setTimeout(() => {
      r.i += r.porcja;
      if (r.i >= r.slowa.length) koniec();
      else krok();
    }, ms);
  }

  function koniec() {
    pauza();
    r.sesja = false;
    r.i = r.slowa.length;
    const s = T.stan.rsvp;
    const rekord = r.tempo > s.rekord;
    if (rekord) s.rekord = r.tempo;
    T.dopisz(s.historia, { kiedy: Date.now(), slowa: r.slowa.length, tempo: r.tempo, rekord });
    T.zapisz();
    const w = $('r-wynik');
    w.textContent = `${rekord ? 'Nowy rekord tempa. ' : ''}Przeczytane: ${r.slowa.length} ${T.odmiana(r.slowa.length, 'słowo', 'słowa', 'słów')}, tempo na końcu ${r.tempo} słów/min. O czym był tekst?`;
    w.hidden = false;
    T.trybGry(false, scena);
    pokaz();
    historia();
  }

  function odNowa() {
    pauza();
    const bylaSesja = r.sesja;
    r.sesja = false;
    r.i = 0;
    r.czasGry = 0;
    czytajUstawienia();
    r.tempo = r.bazowe;
    pokazSlowo();
    pokaz();
    if (bylaSesja) T.trybGry(false, scena);
  }

  const wybor = $('r-wybor-tekstu');

  $('r-graj').addEventListener('click', graj);
  scena.addEventListener('click', graj);
  $('r-od-nowa').addEventListener('click', () => { odNowa(); $('r-wynik').hidden = true; });
  $('r-wstecz').addEventListener('click', () => {
    r.i = Math.max(0, Math.min(r.i, r.slowa.length) - 10);
    pokazSlowo();
    pokaz();
  });
  ['r-tempo-wybor', 'r-porcja', 'r-przyspieszaj'].forEach((id) => $(id).addEventListener('change', () => { czytajUstawienia(); pokazSlowo(); pokaz(); }));
  wybor.addEventListener('change', () => {
    wybierzTekst(wybor.value);
    zaladujTekst();
    lista.odswiez();
    $('r-wynik').hidden = true;
  });
  const lista = T.mojeTeksty($('r-moje'), {
    prefiks: 'r',
    wybrany: () => T.stan.tekst.wybor,
    wybierz(id) { wybierzTekst(id); zaladujTekst(); $('r-wynik').hidden = true; },
    opis: (m) => { const n = m.tresc.split(/\s+/).filter(Boolean).length; return `${n} ${T.odmiana(n, 'słowo', 'słowa', 'słów')}`; },
    poZmianie() { if (!modul.hidden && !r.sesja) zaladujTekst(); },
  });
  $('r-wyczysc').addEventListener('click', () => {
    if (!T.stan.rsvp.historia.length && !T.stan.rsvp.rekord) return;
    if (!confirm('Usunąć wyniki i rekord RSVP?')) return;
    T.stan.rsvp = { rekord: 0, historia: [] };
    T.zapisz();
    pokaz();
    historia();
  });
  window.addEventListener('resize', () => { if (!modul.hidden) pokazSlowo(); });

  T.moduly.rsvp = {
    wejdz() {
      odswiezWybory();
      lista.odswiez();
      zaladujTekst();
      historia();
    },
    wyjdz() { pauza(); r.sesja = false; },
    wTle() { if (r.gra) pauza(); },
  };
})();
