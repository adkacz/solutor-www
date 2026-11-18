/* Trener czytania — wyszukiwanie pojęć: ważne słowa z tekstu klikane w kolejności występowania.
   Tekst wybiera się w ćwiczeniu RSVP (T.biezacyTekst). Słowa wstawiane tylko przez textContent. */
'use strict';

(() => {
  const { $, el } = T;
  const STOP = new Set(('i w z do na o że co to się nie a od po ale oraz jego jej ich ty my on ona ono są był była było byli były ' +
    'będzie będą też już tylko jak tak za nad pod przez przed przy dla lub albo im niż aby żeby jest jako także jednak który która ' +
    'które którego której którym którzy tego temu tym tych taki taka takie takich jeśli gdyż więc może można bardzo nawet czyli ' +
    'każdy każda każde kiedy gdzie teraz sobie swoje swój swoją swojej również około wtedy potem dlatego ponieważ między pomiędzy ' +
    'podczas zamiast lecz nasz nasza nasze naszą wiele wszystko wszystkie bowiem tutaj tam nich niej nimi niego nawzajem często ' +
    'zwykle coraz wciąż jeszcze zawsze żaden żadne trzeba znacznie sposób').split(' '));
  const DLUGOSC = { 1: 35, 2: 65, 3: 100, 4: 140 };
  const CELE = { 1: 4, 2: 5, 3: 6, 4: 7 };
  const CZAS_GRY = 60, MAX_BONUS = 30, PODPOWIEDZ_PO_MS = 10000, SZYBKO_S = 10, NAGRODA_S = 5, MIN_SLOW = 12;

  const modul = $('m-pojecia');
  const scena = $('j-scena');
  const kotwica = scena.parentElement;
  const g = {
    aktywna: false, poziom: 1, slowa: [], kolejka: [], k: 0, przesuniecie: 0,
    czas: CZAS_GRY, bonus: 0, wynik: 0, ukonczone: 0, bledy: 0,
    tik: 0, ostatnie: 0, startPoziomu: 0, podpowiedz: false, zegar: null, nastepny: null,
  };
  const czysty = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const naWidok = (t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || t;
  const tokeny = () => T.biezacyTekst().tresc.split(/\s+/).filter(Boolean);

  // Fragment dla poziomu: każdy poziom bierze dalszą część tekstu; gdy tekst się skończy — od początku
  function przygotujPoziom() {
    const wszystkie = tokeny();
    const dl = Math.min(wszystkie.length, DLUGOSC[g.poziom]);
    if (g.przesuniecie + dl > wszystkie.length) g.przesuniecie = 0;
    const wycinek = wszystkie.slice(g.przesuniecie, g.przesuniecie + dl);
    g.przesuniecie += dl;
    g.slowa = wycinek.map((t, i) => ({ t, c: czysty(t), i, klucz: false, ok: false }));

    const ile = {};
    g.slowa.forEach((s) => { ile[s.c] = (ile[s.c] || 0) + 1; });
    const merytoryczne = g.slowa.filter((s) => s.c.length >= 4 && !STOP.has(s.c));
    let kandydaci = merytoryczne.filter((s) => ile[s.c] === 1);   // najpierw słowa, które występują raz
    if (kandydaci.length < CELE[g.poziom]) kandydaci = merytoryczne;
    if (kandydaci.length < CELE[g.poziom]) kandydaci = g.slowa.filter((s) => s.c.length >= 2);
    // Kandydaci dzieleni na k równych odcinków; z każdego najdłuższe słowo (długie częściej niosą treść)
    const k = Math.min(CELE[g.poziom], kandydaci.length);
    for (let j = 0; j < k; j++) {
      const odcinek = kandydaci.slice(Math.floor((j * kandydaci.length) / k), Math.floor(((j + 1) * kandydaci.length) / k));
      odcinek.reduce((a, b) => (b.c.length > a.c.length ? b : a)).klucz = true;
    }
    g.kolejka = g.slowa.filter((s) => s.klucz);
    g.k = 0;
  }

  function rysuj() {
    const zaznacz = $('j-zaznacz').checked;
    scena.replaceChildren();
    for (const s of g.slowa) {
      const span = el('span', 'slowo', s.t);
      if (s.klucz && zaznacz) span.classList.add('klucz');
      if (s.ok) span.classList.add('znalezione');
      span.dataset.i = String(s.i);
      scena.append(span, ' ');
    }
    scena.scrollTop = 0;
  }

  const spanSlowa = (i) => scena.querySelector(`[data-i="${i}"]`);

  function pokaz() {
    const cel = g.kolejka[g.k];
    const z = T.stan.pojecia;
    $('j-cel').textContent = g.aktywna && cel ? `„${naWidok(cel.t)}”` : '—';
    $('j-postep').textContent = g.aktywna && g.kolejka.length ? `${Math.min(g.k + 1, g.kolejka.length)} z ${g.kolejka.length}` : '';
    $('j-czas').textContent = `${T.ulamek(Math.max(0, g.czas))} s`;
    $('j-bonus').textContent = g.bonus >= MAX_BONUS ? 'bonus wykorzystany' : `bonus +${Math.round(g.bonus)}/${MAX_BONUS} s`;
    $('j-wynik').textContent = String(g.wynik);
    $('j-poziom').textContent = `poziom ${g.poziom} z 4`;
    $('j-rekord').textContent = String(z.rekord);
    $('j-rekord-pod').textContent = `najwyższy poziom: ${z.poziom}`;
    const pasek = $('j-pasek');
    pasek.style.width = `${Math.min(100, Math.max(0, (g.czas / CZAS_GRY) * 100))}%`;
    pasek.classList.toggle('malo', g.czas <= 10);
    const t = T.biezacyTekst();
    const n = tokeny().length;
    $('j-tekst-info').textContent = `Tekst: ${t.nazwa}, ${n} ${T.odmiana(n, 'słowo', 'słowa', 'słów')}.`;
  }

  function historia() {
    T.pokazHistorie($('j-historia'), T.stan.pojecia.historia, (w) => ({
      tytul: `${w.wynik} pkt`,
      wartosc: `poziom ${w.poziom}, ukończone: ${w.ukonczone}`,
    }));
  }

  function zatrzymaj() {
    clearInterval(g.zegar);
    clearTimeout(g.nastepny);
    g.zegar = null;
    g.nastepny = null;
    g.aktywna = false;
  }

  function spoczynek() {
    zatrzymaj();
    Object.assign(g, { czas: CZAS_GRY, bonus: 0, wynik: 0, ukonczone: 0, bledy: 0, kolejka: [], k: 0 });
    g.poziom = Number($('j-start-poziom').value) || 1;
    scena.hidden = true;
    $('j-start-blok').hidden = false;
    const zaKrotki = tokeny().length < MIN_SLOW;
    $('j-start').disabled = zaKrotki;
    $('j-start-tekst').textContent = zaKrotki
      ? `Tekst jest za krótki (potrzeba co najmniej ${MIN_SLOW} słów). Wybierz albo wklej tekst w ćwiczeniu RSVP.`
      : 'Masz 60 sekund. Pomyłka zabiera 1 s, a poziom ukończony w 10 s dodaje 5 s.';
    pokaz();
  }

  function start() {
    if (tokeny().length < MIN_SLOW) return;
    zatrzymaj();
    Object.assign(g, { czas: CZAS_GRY, bonus: 0, wynik: 0, ukonczone: 0, bledy: 0, przesuniecie: 0, aktywna: true });
    g.poziom = Number($('j-start-poziom').value) || 1;
    $('j-wynik-koniec').hidden = true;
    $('j-start-blok').hidden = true;
    scena.hidden = false;
    T.trybGry(true, modul);
    nowyPoziom();
    g.tik = performance.now();
    g.zegar = setInterval(tik, 80);
  }

  function nowyPoziom() {
    przygotujPoziom();
    rysuj();
    g.startPoziomu = performance.now();
    g.ostatnie = g.startPoziomu;
    g.podpowiedz = false;
    pokaz();
  }

  function tik() {
    if (!g.aktywna) return;
    const teraz = performance.now();
    g.czas -= (teraz - g.tik) / 1000;
    g.tik = teraz;
    if (g.czas <= 0) { g.czas = 0; koniec(); return; }
    if ($('j-podpowiedz').checked && !g.podpowiedz && teraz - g.ostatnie >= PODPOWIEDZ_PO_MS) {
      g.podpowiedz = true;
      const cel = g.kolejka[g.k];
      const span = cel && spanSlowa(cel.i);
      if (span) {
        span.classList.add('podpowiedz');
        scena.scrollTop = Math.max(0, span.offsetTop - scena.clientHeight / 2);
      }
    }
    $('j-czas').textContent = `${T.ulamek(g.czas)} s`;
    const pasek = $('j-pasek');
    pasek.style.width = `${Math.min(100, (g.czas / CZAS_GRY) * 100)}%`;
    pasek.classList.toggle('malo', g.czas <= 10);
  }

  function poziomUkonczony() {
    g.ukonczone++;
    const czasPoziomu = (performance.now() - g.startPoziomu) / 1000;
    if (czasPoziomu <= SZYBKO_S) {
      const zostalo = Math.max(0, MAX_BONUS - g.bonus);
      if (zostalo > 0) {
        const dodane = Math.min(NAGRODA_S, zostalo);
        g.czas = Math.min(CZAS_GRY, g.czas + dodane);
        g.bonus += dodane;
        T.odznaka(kotwica, `Szybko! +${dodane} s`);
      } else {
        g.wynik += 150;
        T.odznaka(kotwica, 'Szybko! +150 pkt', 'premia');
      }
    } else {
      T.odznaka(kotwica, 'Poziom ukończony');
    }
    if (g.poziom < 4) g.poziom++;
    else g.wynik += 200;   // premia za ukończenie najwyższego poziomu
    pokaz();
    g.nastepny = setTimeout(() => { if (g.aktywna) nowyPoziom(); }, 900);
  }

  function koniec() {
    zatrzymaj();
    const z = T.stan.pojecia;
    const rekord = g.wynik > z.rekord;
    if (rekord) z.rekord = g.wynik;
    if (g.poziom > z.poziom) z.poziom = g.poziom;
    T.dopisz(z.historia, { kiedy: Date.now(), wynik: g.wynik, poziom: g.poziom, ukonczone: g.ukonczone, rekord });
    T.zapisz();
    const w = $('j-wynik-koniec');
    w.textContent = `${rekord ? 'Nowy rekord! ' : 'Koniec czasu. '}Wynik: ${g.wynik} pkt, ukończone poziomy: ${g.ukonczone}, pomyłki: ${g.bledy}.`;
    w.hidden = false;
    const wynik = g.wynik, poziom = g.poziom;
    spoczynek();
    g.wynik = wynik;
    g.poziom = poziom;
    $('j-start').textContent = 'Jeszcze raz';
    pokaz();
    T.trybGry(false, w);
    historia();
  }

  scena.addEventListener('click', (ev) => {
    const span = ev.target.closest('.slowo');
    if (!span || !g.aktywna) return;
    const s = g.slowa[Number(span.dataset.i)];
    const cel = g.kolejka[g.k];
    if (!s || s.ok || !cel) return;
    if (s.c === cel.c) {   // to samo słowo w innym miejscu fragmentu też się liczy
      s.ok = true;
      if (s !== cel) {
        cel.klucz = false;
        s.klucz = true;
        g.kolejka[g.k] = s;
        const stary = spanSlowa(cel.i);
        if (stary) stary.classList.remove('klucz', 'podpowiedz');
      }
      span.classList.remove('klucz', 'podpowiedz');
      span.classList.add('znalezione');
      g.k++;
      g.ostatnie = performance.now();
      g.podpowiedz = false;
      g.wynik += 25;
      T.odznaka(kotwica, '+25 pkt');
      if (g.k >= g.kolejka.length) poziomUkonczony();
      else pokaz();
    } else {
      g.bledy++;
      g.czas = Math.max(0.1, g.czas - 1);
      T.migniecie(span, 'zle', 300);
      T.odznaka(kotwica, 'Pomyłka: -1 s', 'kara');
      pokaz();
    }
  });
  $('j-start').addEventListener('click', start);
  $('j-start-poziom').addEventListener('change', () => { if (!g.aktywna) spoczynek(); });
  $('j-zaznacz').addEventListener('change', () => { if (g.aktywna) rysuj(); });
  $('j-zmien-tekst').addEventListener('click', () => T.przelacz('rsvp'));
  $('j-wyczysc').addEventListener('click', () => {
    if (!T.stan.pojecia.historia.length && !T.stan.pojecia.rekord) return;
    if (!confirm('Usunąć wyniki i rekord wyszukiwania pojęć?')) return;
    T.stan.pojecia = { rekord: 0, poziom: 0, historia: [] };
    T.zapisz();
    pokaz();
    historia();
  });

  T.moduly.pojecia = {
    wejdz() { $('j-wynik-koniec').hidden = true; $('j-start').textContent = 'Start'; spoczynek(); historia(); },
    wyjdz: zatrzymaj,
    przerwij() { spoczynek(); T.trybGry(false, $('j-start-blok')); },
  };
})();
