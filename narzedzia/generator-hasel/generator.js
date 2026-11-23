// Generator haseł ze słów — Solutor.
// Losowanie wyłącznie w przeglądarce (crypto.getRandomValues), nic nie jest wysyłane ani zapisywane.
// Siła liczona przy założeniu, że atakujący zna listę słów i cały sposób losowania (zasada Kerckhoffsa).
'use strict';

// Lista słów: oryginał wygenerowany z pomocą Gemini (17.11.2026), bez polskich znaków i bez powtórzeń.
const SLOWA = [
  "adres","agrest","aktor","album","alert","ananas","antena","aparat","apteka","arbuz",
  "arena","armata","artysta","asfalt","atlas","atom","autobus","awans","balkon","balon",
  "bambus","banan","banknot","basen","bateria","bazar","beczka","bekon","beret","beton",
  "bilet","biurko","biznes","blacha","blizna","bluzka","bocian","bomba","brama","brat",
  "broda","brzeg","brzoza","budzik","bukiet","bulion","bunkier","burak","burza","butelka",
  "cebula","cement","cennik","centrum","cesarz","chata","chleb","chmura","chodnik","choinka",
  "chrzan","chustka","ciasto","cukier","cygaro","cyrkiel","cytryna","czajnik","czapka","czosnek",
  "czytnik","dach","daktyl","dama","delfin","deser","deska","deszcz","diament","dieta",
  "dinozaur","doniczka","drabina","dramat","drewno","droga","drukarka","drut","drzewo","duch",
  "dyplom","dyrektor","dysk","dywan","dzbanek","dziadek","dziennik","dzwon","egzamin","ekierka",
  "ekipa","ekran","ekspert","eliksir","energia","epoka","etykieta","fabryka","fajka","fala",
  "farba","fartuch","fasola","festiwal","figura","filar","film","filtr","firanka","flaga",
  "flakon","flaming","flota","foka","folder","folia","fontanna","forteca","fortepian","fotel",
  "fryzjer","futro","gabinet","galaktyka","galeria","garnek","gazeta","gepard","gitara","glina",
  "globus","gniazdo","godzina","gondola","goniec","goryl","granat","granica","granit","gruszka",
  "grzebyk","grzyb","guma","guzik","gwiazda","gwizdek","haczyk","hamak","hamulec","hangar",
  "harcerz","harfa","herbata","hiena","hipopotam","historia","hokej","hotel","humor","huragan",
  "hydrant","hymn","iglo","ikona","iluzja","imbir","imbryk","impuls","indyk","instrument",
  "inwestor","irys","iskra","izba","jacht","jagoda","jajko","jaskinia","jaszczurka","jawor",
  "jedwab","jezioro","jogurt","jubiler","kabel","kabina","kaczka","kajak","kakao","kaktus",
  "kalendarz","kalosz","kamizelka","kanapa","kanarek","kanapka","kangur","kanister","kapelusz","kapitan",
  "kapusta","karabin","karafka","karetka","karnet","karoca","karp","karta","karton","karuzela",
  "kasa","kaseta","kask","kasztan","katalog","katedra","kawa","kieliszek","kierowca","kino",
  "klatka","klawisz","klejnot","klient","klimat","klinika","klosz","klub","klucz","kobieta",
  "kobra","kogut","kokos","kolacja","kolano","kolejka","koliber","kolumna","komar","kometa",
  "komiks","komin","komoda","kompas","komputer","koncert","konewka","konsola","kontakt","kontener",
  "kopalnia","koperta","koral","korek","korona","korytarz","kosmita","kostium","kostka","koszula",
  "koszyk","kotlet","kotwica","kowal","koza","krab","krater","krawat","kredens","kredka",
  "krem","krewetka","krokodyl","kropka","krowa","kruk","krzew","kubek","kuchnia","kukurydza",
  "kula","kupon","kura","kurier","kurtka","kuzyn","kwadrat","kwarc","kwiat","lakier",
  "lalka","lama","lampa","lampion","laser","laska","latarka","latarnia","lawenda","lawina",
  "legenda","lekarz","lekcja","lemur","leopard","lejek","lina","linijka","lipa","list",
  "listonosz","lis","litera","lodowiec","lokata","lokomotywa","lornetka","lotnisko","lustro","lutnia",
  "maczuga","magazyn","magik","magnes","makaron","makowiec","malarz","malina","mamut","mandarynka",
  "mandat","manekin","mango","mapa","marchew","marmur","marynarz","marzec","maska","maszyna",
  "maszt","matura","medal","meduza","megafon","melodia","melon","metal","meteor","metro",
  "mewa","miecz","miejsce","mikrofon","mikser","milioner","mina","minuta","miska","mistrz",
  "mleko","model","modem","moneta","monitor","morze","most","motor","motyl","mucha",
  "mundur","muszla","muzeum","muzyka","mysz","naczynie","nadajnik","nagroda","naklejka","namiot",
  "narty","naszyjnik","natura","nauczyciel","nauka","nektar","neon","nerka","niebo","niedziela",
  "nietoperz","nitka","noga","notes","numer","nurek","nuta","oaza","obiad","obraz",
  "obrus","ocean","odkurzacz","odznaka","ogonek","okienko","okno","okulary","olbrzym","olej",
  "oliwka","omlet","opera","opiekun","opona","optyk","orbita","order","orkiestra","orzech",
  "osada","osoba","ostrze","owad","owca","owoc","ozdoba","paczka","pakiet","palec",
  "paleta","paliwo","palma","panda","panel","pantera","pantofel","papier","papryka","papuga",
  "parada","paragon","parasol","parawan","parking","parter","partner","pasek","pasta","pasterz",
  "paszport","patelnia","patent","patrol","patyk","pawian","pazur","peleryna","pelikan","peron",
  "peruka","pestka","petarda","pianino","piasek","piec","pieprz","piernik","pies","piknik",
  "pilot","pingwin","piorun","piosenka","piramida","pirat","pisarz","pistolet","piwnica","piwo",
  "plakat","plama","plan","planeta","plastik","platforma","plecak","pocisk","poczta","podatek",
  "podkowa","podpis","poduszka","poeta","pogoda","pojazd","pojemnik","pokrowiec","polana","pole",
  "policjant","pomadka","pomidor","pomnik","pompa","ponton","poranek","porcelana","port","portfel",
  "portret","potok","powiat","powietrze","poziomka","praca","pralka","prasa","precel","prezent",
  "prezydent","procesor","produkt","profesor","program","projekt","prom","promyk","prosiak","proszek",
  "prysznic","przystanek","przyczepa","przygoda","przepis","przerwa","ptak","puchar","puder","pulpit",
  "punkt","pustynia","puszka","puzon","pyton","rabat","rachunek","radar","radio","rakieta",
  "rama","ranczo","randka","raport","ratownik","ratusz","reaktor","recepta","redaktor","rekin",
  "reklama","rekord","remont","renifer","reporter","rezerwuar","robak","robot","rodzina","rolka",
  "rolnik","rondo","ropucha","rower","rozmowa","rubin","ruina","rulon","rumianek","runda",
  "rura","ryba","rybak","rycerz","rydwan","rynek","rysik","rysunek","rytm","rzeka",
  "rzodkiewka","rzutnik","sadzonka","salon","samolot","samuraj","sanki","sarna","satelita","scena",
  "schemat","schody","schron","sejf","sekret","sekunda","seler","senator","serce","sernik",
  "serwer","serwetka","sezon","siatka","siekiera","sierp","silnik","siostra","skala","skalpel",
  "skaner","skarpetka","skarb","sklep","skoczek","skorupa","skorpion","skrzynia","skrzypce","skuter",
  "smak","smok","smycz","sobota","sofa","sok","sonata","sonda","sopel","sosna",
  "sowa","spacer","spadochron","spinka","spirala","spodnie","sport","spotkanie","srebro","stadion",
  "stajnia","stal","statek","statua","staw","stempel","ster","stolica","stolarz","stopa",
  "stoper","storczyk","stragan","strefa","strona","struna","strych","student","studnia","studio",
  "sufit","sukces","sukienka","suwak","sweter","symbol","sypialnia","syrena","syrop","system",
  "szabla","szachy","szafa","szafir","szalik","szalupa","szampon","szansa","szarlotka","szatnia",
  "szczotka","szczyt","szef","szelki","szeryf","szklanka","szkielet","szkic","szlafrok","szlak",
  "szmaragd","sznurek","szopa","szpadel","szpinak","szpital","sztaba","sztandar","sztorm","szuflada",
  "szynka","szyba","szyfr","szyja","szyna","szyszka","tabela","tablica","taboret","taczka",
  "tajemnica","tajfun","talerz","talent","talizman","tama","tamburyn","taniec","tapczan","tapeta",
  "taras","tarcza","targ","tarka","tartak","tasak","teatr","teczka","tekst","telefon",
  "teleskop","telewizor","temat","tenis","teren","termos","termit","tlen","toaleta","torba",
  "tornado","torpeda","tort","traktor","tramwaj","trampolina","transport","trapez","tratwa","trawa",
  "trawnik","trener","trening","tron","tropik","truskawka","trybuna","trzmiel","tulipan","tkanina",
  "tunel","tunika","turbina","turniej","turysta","tusz","twarz","twierdza","tygrys","tytan",
  "ubranie","uchwyt","uczta","ukulele","ulica","ulotka","umowa","upominek","urlop","urna",
  "usterka","uszko","wachlarz","wafel","waga","wagon","wakacje","walec","walizka","walka",
  "waluta","wampir","wanilia","wanna","warkocz","warsztat","warzywo","wazon","wdowa","wektor",
  "welon","wulkan","wentylator","weranda","wersalka","wesele","weteran","wiadro","wiadukt","wiatr",
  "wiatrak","widelec","widok","wieko","wieloryb","wieniec","wierzba","wiersz","wieszak","wigilia",
  "wiking","wiklina","willa","winda","wino","winogrono","wioska","wiosna","wirus","wisiorek",
  "witamina","witryna","wizyta","woda","wodospad","wojownik","wojsko","worek","wrona","wrota",
  "wrzos","wujek","wybuch","wycieczka","wydma","wydra","wyjazd","wynalazek","wynik","wypadek",
  "wyprawa","wyraz","wyrok","wyspa","wystawa","zabawa","zabawka","zabytek","zagadka","zagroda",
  "zakaz","zakonnik","zakupy","zatoka","zamek","zamsz","zapach","zapas","zapiekanka","zapis",
  "zapora","zasada","zastawa","zastrzyk","zatyczka","zawias","zawodnik","zbiornik","zbroja","zdanie",
  "zdobycz","zdrowie","zebra","zegar","zegarek","zeszyt","zgoda","ziarno","zielnik","ziemia",
  "ziemniak","zima","zjazd","zmiana","zmierzch","znaczek","znak","znicz","zorza","zuch",
  "zupa","zwierzak","zygzak","zysk"
];

// Scenariusze ataku (rząd wielkości, publiczny test hashcata na RTX 5090, źródła w sekcji „Skąd te liczby”):
// - sejf menedżera haseł: Bitwarden domyślnie PBKDF2-SHA256, 600 000 iteracji — ok. 19 tys. prób/s na kartę,
//   100 kart ok. 1,9 mln prób/s;
// - hasło zapisane przez serwis szybkim skrótem SHA-1: ok. 70 mld prób/s na kartę, 100 kart ok. 7 bln prób/s.
const PROBY_SEJF = 1.9e6;
const PROBY_SZYBKI = 7e12;
// Progi oceny według EFF: 64 bity chronią przed przestępcą, 77 przed niemal każdym atakującym.
const PROG_DOBRA = 64;
const PROG_BARDZO_DOBRA = 77;

const stan = {
  slowa: [],        // wylosowane słowa (małe litery)
  wielkie: [],      // dla trybu „losowo”: które słowa z wielką literą
  miejsceCyfry: 0,  // przy którym słowie stoi cyfra
  cyfra: 0,
  ukryte: false,
};

const $ = (id) => document.getElementById(id);

// Losowa liczba całkowita 0..max-1 bez faworyzowania (odrzucanie wyników z niepełnego przedziału).
function losuj(max) {
  const tab = new Uint32Array(1);
  const granica = 0x100000000 - (0x100000000 % max);
  do {
    crypto.getRandomValues(tab);
  } while (tab[0] >= granica);
  return tab[0] % max;
}

function losujWielkie(n) {
  // Każde słowo z prawdopodobieństwem 1/2, ale co najmniej jedno (wymóg wielu serwisów): 2^n − 1 możliwości.
  let w;
  do {
    w = Array.from({ length: n }, () => losuj(2) === 1);
  } while (!w.some(Boolean));
  return w;
}

function liczba() { return parseInt($('liczba').value, 10); }

function nowe() {
  const n = liczba();
  stan.slowa = Array.from({ length: n }, () => SLOWA[losuj(SLOWA.length)]);
  stan.wielkie = losujWielkie(n);
  stan.miejsceCyfry = losuj(n);
  stan.cyfra = losuj(10);
  pokaz();
}

function zmianaLiczby() {
  // Te same słowa zostają, dochodzą nowe; wielkie litery i miejsce cyfry losowane od nowa dla nowej długości.
  const n = liczba();
  while (stan.slowa.length < n) stan.slowa.push(SLOWA[losuj(SLOWA.length)]);
  stan.slowa.length = n;
  stan.wielkie = losujWielkie(n);
  stan.miejsceCyfry = losuj(n);
  pokaz();
}

function haslo() {
  const tryb = $('wielkie').value;
  const z_cyfra = $('cyfra').checked;
  return stan.slowa.map((s, i) => {
    let w = s;
    if (tryb === 'kazde' || (tryb === 'losowo' && stan.wielkie[i])) w = w.charAt(0).toUpperCase() + w.slice(1);
    if (z_cyfra && i === stan.miejsceCyfry) w += String(stan.cyfra);
    return w;
  }).join($('separator').value);
}

function bity() {
  const n = stan.slowa.length;
  let b = n * Math.log2(SLOWA.length);
  if ($('wielkie').value === 'losowo') b += Math.log2(Math.pow(2, n) - 1);
  if ($('cyfra').checked) b += Math.log2(10 * n);   // 10 cyfr × n miejsc
  return b;
}

const LICZBA = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

function lat(l) {
  // odmiana: 1 rok, 2–4 lata, 5+ lat (z wyjątkiem 12–14)
  const r = Math.round(l);
  if (r === 1) return 'rok';
  const d = r % 10, s = r % 100;
  return (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) ? 'lata' : 'lat';
}

function czas(sekundy) {
  if (sekundy < 1) return 'poniżej sekundy';
  if (sekundy < 60) return `ok. ${Math.round(sekundy)} s`;
  if (sekundy < 3600) return `ok. ${Math.round(sekundy / 60)} min`;
  if (sekundy < 86400) return `ok. ${Math.round(sekundy / 3600)} godz.`;
  const dni = sekundy / 86400;
  if (dni < 60) return `ok. ${Math.round(dni)} dni`;
  const l = dni / 365.25;
  if (l < 2) return `ok. ${Math.round(dni / 30.44)} mies.`;
  if (l < 1e3) return `ok. ${Math.round(l)} ${lat(l)}`;
  if (l < 1e6) return `ok. ${LICZBA.format(Math.round(l / 1e3))} tys. lat`;
  if (l < 1e9) return `ok. ${LICZBA.format(Math.round(l / 1e6))} mln lat`;
  if (l < 1e12) return `ok. ${LICZBA.format(Math.round(l / 1e9))} mld lat`;
  return 'ponad bilion lat';
}

function pokazSile() {
  const b = bity();
  const srednio = Math.pow(2, b - 1);   // średnio trzeba sprawdzić połowę możliwości
  $('bity').textContent = `${b.toFixed(1).replace('.', ',')} bita`;
  $('czas-sejf').textContent = czas(srednio / PROBY_SEJF);
  $('czas-szybki').textContent = czas(srednio / PROBY_SZYBKI);

  const pasek = $('pasek');
  pasek.style.width = `${Math.min(100, Math.max(8, ((b - 35) / 45) * 100))}%`;
  const ocena = $('ocena');
  const rada = $('podpowiedz');
  rada.classList.remove('dobrze');
  if (b < PROG_DOBRA) {
    pasek.style.backgroundColor = 'var(--ember)';
    ocena.textContent = 'Siła: za mała na hasło główne';
    rada.textContent = $('cyfra').checked
      ? 'Dodaj słowo: każde kolejne słowo to prawie 10 bitów, czyli ok. 900 razy więcej możliwości.'
      : 'Włącz losową cyfrę albo dodaj słowo: każde kolejne słowo to ok. 900 razy więcej możliwości.';
  } else if (b < PROG_BARDZO_DOBRA) {
    pasek.style.backgroundColor = 'var(--ok)';
    ocena.textContent = 'Siła: dobra';
    rada.classList.add('dobrze');
    rada.textContent = $('cyfra').checked
      ? 'Dobre hasło główne. Kolejne słowo da większy zapas.'
      : 'Dobre hasło główne. Losowa cyfra albo kolejne słowo dadzą większy zapas.';
  } else {
    pasek.style.backgroundColor = 'var(--ok)';
    ocena.textContent = 'Siła: bardzo dobra';
    rada.classList.add('dobrze');
    rada.textContent = 'Dobre hasło główne. Nie poprawiaj słów na własne: siła bierze się wyłącznie z losowania.';
  }
}

function pokaz() {
  const h = haslo();
  const pole = $('haslo');
  pole.textContent = stan.ukryte ? '•'.repeat(Math.min(h.length, 28)) : h;
  pole.classList.toggle('ukryte', stan.ukryte);
  $('kr-haslo').textContent = $('pusta-karta').checked ? '' : h;
  $('kr-data').textContent = new Date().toLocaleDateString('pl-PL');
  pokazSile();
  const k = $('kopiuj');
  k.textContent = 'Kopiuj';
  k.classList.remove('zrobione');
}

async function kopiuj() {
  const k = $('kopiuj');
  try {
    await navigator.clipboard.writeText(haslo());
    k.textContent = 'Skopiowano';
    k.classList.add('zrobione');
  } catch (e) {
    k.textContent = 'Nie udało się skopiować';
  }
}

function ukryj() {
  stan.ukryte = !stan.ukryte;
  const u = $('ukryj');
  u.textContent = stan.ukryte ? 'Pokaż' : 'Ukryj';
  u.setAttribute('aria-pressed', String(stan.ukryte));
  pokaz();
}

document.addEventListener('DOMContentLoaded', () => {
  $('liczba-slow').textContent = String(SLOWA.length);
  $('losuj').addEventListener('click', nowe);
  $('kopiuj').addEventListener('click', kopiuj);
  $('ukryj').addEventListener('click', ukryj);
  $('drukuj').addEventListener('click', () => { pokaz(); window.print(); });
  $('liczba').addEventListener('change', zmianaLiczby);
  ['wielkie', 'separator', 'cyfra', 'pusta-karta'].forEach((id) => $(id).addEventListener('change', pokaz));
  nowe();
});
