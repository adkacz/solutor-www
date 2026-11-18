/* Trener czytania — tablica Schultego */
'use strict';

(() => {
  const { $ } = T;
  const modul = $('m-schulte');
  const plansza = $('s-plansza');
  const nakladka = $('s-nakladka');
  const g = { n: 5, znaki: 'liczby', kolejka: [], i: 0, bledy: 0, trwa: false, start: 0, zegar: null };

  // 0 › A, 25 › Z, 26 › AA … (przy 10×10 ostatnia to CV)
  function litera(i) {
    let w = '';
    for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) w = String.fromCharCode(65 + (n % 26)) + w;
    return w;
  }
  const klucz = () => `${g.n}_${g.znaki}`;

  function czytajUstawienia() {
    g.n = Math.min(10, Math.max(3, Number($('s-rozmiar').value) || 5));
    g.znaki = $('s-znaki').value === 'litery' ? 'litery' : 'liczby';
    g.kolejka = Array.from({ length: g.n * g.n }, (_, i) => (g.znaki === 'liczby' ? String(i + 1) : litera(i)));
  }

  function pokazNakladke(tytul, tekst, przycisk) {
    $('s-nakl-tytul').textContent = tytul;
    $('s-nakl-tekst').textContent = tekst;
    $('s-start').textContent = przycisk;
    nakladka.hidden = false;
  }

  function pokaz() {
    const ile = g.kolejka.length;
    $('s-cel').textContent = g.i < ile ? g.kolejka[g.i] : '—';
    $('s-postep').textContent = `${g.i} z ${ile}`;
    $('s-bledy').textContent = String(g.bledy);
    const r = T.stan.schulte.rekordy[klucz()];
    $('s-rekord').textContent = r ? `${T.ulamek(r, 2)} s` : '—';
    $('s-rekord-pod').textContent = `${g.n}×${g.n}, ${g.znaki}`;
  }

  function historia() {
    T.pokazHistorie($('s-historia'), T.stan.schulte.historia, (w) => ({
      tytul: `${w.n}×${w.n} ${w.znaki}`,
      wartosc: `${T.ulamek(w.czas, 2)} s${w.bledy ? `, pomyłki: ${w.bledy}` : ''}`,
    }));
  }

  function zatrzymaj() {
    clearInterval(g.zegar);
    g.zegar = null;
    g.trwa = false;
  }

  function przygotuj() {
    zatrzymaj();
    czytajUstawienia();
    g.i = 0;
    g.bledy = 0;
    T.ustawPlansze(plansza, g.n, T.tasuj(g.kolejka));
    $('s-czas').textContent = '0,0 s';
    pokazNakladke(`Tablica ${g.n}×${g.n}`,
      `Klikaj po kolei od ${g.kolejka[0]} do ${g.kolejka[g.kolejka.length - 1]}. Czas liczy się od kliknięcia Start.`, 'Start');
    pokaz();
  }

  function start() {
    czytajUstawienia();
    g.i = 0;
    g.bledy = 0;
    T.ustawPlansze(plansza, g.n, T.tasuj(g.kolejka));
    nakladka.hidden = true;
    $('s-ramka').classList.remove('wygrana');
    g.trwa = true;
    g.start = performance.now();
    clearInterval(g.zegar);
    g.zegar = setInterval(() => { $('s-czas').textContent = `${T.ulamek((performance.now() - g.start) / 1000)} s`; }, 100);
    T.trybGry(true, modul);
    pokaz();
  }

  function koniec() {
    const czas = Math.round(performance.now() - g.start) / 1000;
    zatrzymaj();
    const s = T.stan.schulte;
    const poprzedni = s.rekordy[klucz()];
    const rekord = !poprzedni || czas < poprzedni;
    if (rekord) s.rekordy[klucz()] = czas;
    T.dopisz(s.historia, { kiedy: Date.now(), n: g.n, znaki: g.znaki, czas, bledy: g.bledy, rekord });
    T.zapisz();
    $('s-czas').textContent = `${T.ulamek(czas, 2)} s`;
    $('s-ramka').classList.add('wygrana');
    setTimeout(() => $('s-ramka').classList.remove('wygrana'), 600);
    pokazNakladke(rekord ? 'Nowy rekord!' : 'Gotowe',
      `${T.ulamek(czas, 2)} s, pomyłki: ${g.bledy}.${!rekord && poprzedni ? ` Rekord: ${T.ulamek(poprzedni, 2)} s.` : ''}`, 'Jeszcze raz');
    T.trybGry(false, $('s-ramka'));
    pokaz();
    historia();
  }

  plansza.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pole-planszy');
    if (!b || !g.trwa || b.classList.contains('trafione')) return;
    if (b.dataset.v === g.kolejka[g.i]) {
      g.i++;
      if ($('s-wygaszaj').checked) b.classList.add('trafione');
      else T.migniecie(b, 'blysk-dobry', 180);
      if (g.i >= g.kolejka.length) koniec();
      else pokaz();
    } else {
      g.bledy++;
      T.migniecie(b, 'blysk-zly', 260);
      pokaz();
    }
  });
  $('s-start').addEventListener('click', start);
  $('s-rozmiar').addEventListener('change', przygotuj);
  $('s-znaki').addEventListener('change', przygotuj);
  $('s-punkt').addEventListener('change', () => { $('s-punkt-srodek').hidden = !$('s-punkt').checked; });
  $('s-wyczysc').addEventListener('click', () => {
    if (!T.stan.schulte.historia.length && !Object.keys(T.stan.schulte.rekordy).length) return;
    if (!confirm('Usunąć wyniki i rekordy tablicy Schultego?')) return;
    T.stan.schulte = { rekordy: {}, historia: [] };
    T.zapisz();
    pokaz();
    historia();
  });

  T.moduly.schulte = {
    wejdz() { przygotuj(); historia(); },
    wyjdz: zatrzymaj,
    przerwij() { przygotuj(); T.trybGry(false, $('s-ramka')); },
  };
})();
