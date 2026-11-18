/* Trener czytania — widzenie peryferyjne: dwa słowa na ułamek sekundy po bokach punktu */
'use strict';

(() => {
  const { $, el } = T;
  const SLOWA = ['most', 'krew', 'park', 'woda', 'zegar', 'balon', 'trawa', 'rower', 'chleb', 'deszcz', 'klucz', 'lampa',
    'statek', 'ogień', 'wiatr', 'zamek', 'drzewo', 'kamień', 'planeta', 'kompas', 'pociąg', 'miasto', 'książka', 'słońce'];
  const RUND = 12, START_PX = 140, KROK_W_GORE = 36, KROK_W_DOL = 24, ZAKRYTE = '••••';

  const modul = $('m-peryferyjne');
  const scena = $('p-scena');
  const p = { aktywna: false, czeka: false, runda: 0, rozp: START_PX, max: START_PX, wynik: 0, seria: 0, lewa: '', prawa: '', zegary: [], minPol: 50, maxPol: 240 };
  const bodzce = () => ($('p-bodzce').value === 'liczby' ? 'liczby' : 'slowa');

  function wyczyscZegary() { p.zegary.forEach(clearTimeout); p.zegary = []; }
  const pozniej = (fn, ms) => { p.zegary.push(setTimeout(fn, ms)); };

  // Zakres odstępu: słowa nie mogą zasłaniać punktu ani wychodzić poza scenę (na telefonie zakres jest mniejszy)
  function zakres() {
    const px = parseFloat(getComputedStyle($('p-lewa')).fontSize) || 20;
    const w = bodzce() === 'liczby'
      ? T.szerokosc('888', px, 800)
      : Math.max(...SLOWA.map((s) => T.szerokosc(s, px, 800)));
    p.minPol = Math.ceil(w / 2 + 16);
    p.maxPol = Math.max(p.minPol, Math.floor(scena.clientWidth / 2 - w / 2 - 6));
  }
  const ogranicz = (x) => Math.min(2 * p.maxPol, Math.max(2 * p.minPol, x));

  function skrzydla(lewa, prawa, zakryte) {
    const pol = Math.round(p.rozp / 2);
    $('p-lewa').style.left = `calc(50% - ${pol}px)`;
    $('p-prawa').style.left = `calc(50% + ${pol}px)`;
    $('p-linia').style.width = `${p.rozp}px`;
    $('p-lewa').textContent = lewa;
    $('p-prawa').textContent = prawa;
    $('p-lewa').classList.toggle('zakryte', zakryte);
    $('p-prawa').classList.toggle('zakryte', zakryte);
  }

  function pokaz() {
    const z = T.stan.peryferyjne;
    $('p-runda').textContent = `${p.runda} z ${RUND}`;
    $('p-seria').textContent = `seria: ${p.seria}`;
    $('p-rozp').textContent = `${p.rozp} px`;
    $('p-wynik').textContent = String(p.wynik);
    $('p-rekord').textContent = `${z.rozpietosc} px`;
    $('p-rekord-pod').textContent = `punktów: ${z.wynik}`;
  }

  function historia() {
    T.pokazHistorie($('p-historia'), T.stan.peryferyjne.historia, (w) => ({
      tytul: w.bodzce === 'liczby' ? 'Liczby' : 'Słowa',
      wartosc: `${w.rozpietosc} px, ${w.wynik} pkt`,
    }));
  }

  function losuj(wykluczone) {
    if (bodzce() === 'liczby') {
      let n;
      do { n = String(100 + T.losowa(900)); } while (wykluczone.includes(n));
      return n;
    }
    return T.wybierz(SLOWA.filter((s) => !wykluczone.includes(s)));
  }

  function spoczynek() {
    wyczyscZegary();
    p.aktywna = false;
    p.czeka = false;
    p.runda = 0;
    p.seria = 0;
    p.wynik = 0;
    zakres();
    p.rozp = ogranicz(START_PX);
    p.max = 0;   // największy odstęp, przy którym odpowiedź była dobra
    $('p-punkt').classList.remove('ladowanie');
    $('p-wybory').hidden = true;
    $('p-start').hidden = false;
    $('p-powtorz').disabled = true;
    skrzydla(ZAKRYTE, ZAKRYTE, true);
    pokaz();
  }

  function start() {
    spoczynek();
    p.aktywna = true;
    $('p-start').hidden = true;
    $('p-wynik-koniec').hidden = true;
    T.trybGry(true, modul);
    nastepnaRunda();
  }

  function nastepnaRunda() {
    p.runda++;
    p.czeka = false;
    p.lewa = losuj([]);
    p.prawa = losuj([p.lewa]);
    $('p-wybory').hidden = true;
    pokaz();
    blysk();
  }

  function blysk() {
    wyczyscZegary();
    const ms = Number($('p-czas').value) || 240;
    $('p-powtorz').disabled = true;
    skrzydla(ZAKRYTE, ZAKRYTE, true);
    $('p-punkt').classList.add('ladowanie');
    pozniej(() => {
      $('p-punkt').classList.remove('ladowanie');
      skrzydla(p.lewa, p.prawa, false);
      pozniej(() => {
        skrzydla(ZAKRYTE, ZAKRYTE, true);
        p.czeka = true;
        $('p-powtorz').disabled = false;
        wybory();
      }, ms);
    }, 450);
  }

  function wybory() {
    const innaL = losuj([p.lewa, p.prawa]);
    const innaP = losuj([p.lewa, p.prawa, innaL]);
    const opcje = T.tasuj([
      { l: p.lewa, p: p.prawa, dobra: true },
      { l: p.lewa, p: innaP, dobra: false },
      { l: innaL, p: p.prawa, dobra: false },
      { l: innaL, p: innaP, dobra: false },
    ]);
    const kontener = $('p-wybory');
    kontener.replaceChildren(...opcje.map((o) => {
      const b = el('button', 'wybor');
      b.type = 'button';
      b.append(el('span', '', o.l), el('span', 'kropka', '·'), el('span', '', o.p));
      b.addEventListener('click', () => odpowiedz(b, o.dobra));
      return b;
    }));
    kontener.hidden = false;
  }

  function odpowiedz(przycisk, dobra) {
    if (!p.czeka) return;
    p.czeka = false;
    $('p-powtorz').disabled = true;
    $('p-wybory').querySelectorAll('.wybor').forEach((b) => { b.disabled = true; });
    if (dobra) {
      przycisk.classList.add('dobry');
      p.seria++;
      const pkt = Math.round((p.rozp / 2) * (1 + p.seria * 0.2));
      p.wynik += pkt;
      p.max = Math.max(p.max, p.rozp);
      p.rozp = ogranicz(p.rozp + KROK_W_GORE);
      T.odznaka(scena, `Dobrze! +${pkt} pkt`);
    } else {
      przycisk.classList.add('zly');
      p.seria = 0;
      p.rozp = ogranicz(p.rozp - KROK_W_DOL);
      skrzydla(p.lewa, p.prawa, false);   // pokaż, co było
      T.odznaka(scena, 'Nie ta para', 'kara');
    }
    pokaz();
    pozniej(() => { if (p.runda >= RUND) koniec(); else nastepnaRunda(); }, 950);
  }

  function koniec() {
    p.aktywna = false;
    const z = T.stan.peryferyjne;
    const rekord = p.max > z.rozpietosc;
    if (rekord) z.rozpietosc = p.max;
    if (p.wynik > z.wynik) z.wynik = p.wynik;
    T.dopisz(z.historia, { kiedy: Date.now(), bodzce: bodzce(), rozpietosc: p.max, wynik: p.wynik, rekord });
    T.zapisz();
    const w = $('p-wynik-koniec');
    w.textContent = p.max
      ? `${rekord ? 'Nowy rekord odstępu. ' : ''}Największy odstęp z dobrą odpowiedzią: ${p.max} px, punkty: ${p.wynik}.`
      : 'Tym razem bez dobrej odpowiedzi. Spróbuj z dłuższym błyskiem (350 ms).';
    w.hidden = false;
    const wynik = p.wynik;
    spoczynek();
    p.wynik = wynik;
    pokaz();
    T.trybGry(false, scena);
    historia();
  }

  $('p-start').addEventListener('click', start);
  $('p-powtorz').addEventListener('click', () => { if (p.aktywna && p.czeka) { p.czeka = false; $('p-wybory').hidden = true; blysk(); } });
  $('p-bodzce').addEventListener('change', spoczynek);
  $('p-wyczysc').addEventListener('click', () => {
    if (!T.stan.peryferyjne.historia.length && !T.stan.peryferyjne.rozpietosc) return;
    if (!confirm('Usunąć wyniki i rekordy widzenia peryferyjnego?')) return;
    T.stan.peryferyjne = { rozpietosc: 0, wynik: 0, historia: [] };
    T.zapisz();
    pokaz();
    historia();
  });
  window.addEventListener('resize', () => { if (!modul.hidden && !p.aktywna) spoczynek(); });

  T.moduly.peryferyjne = {
    wejdz() { $('p-wynik-koniec').hidden = true; spoczynek(); historia(); },
    wyjdz() { wyczyscZegary(); p.aktywna = false; },
    przerwij() { spoczynek(); T.trybGry(false, scena); },
  };
})();
