/**
 * The words a tour's page adds to the shared ones (page-words.ts, and the map's own in
 * apps/web/src/i18n/<lang>.json, which give the days on foot and "by sea"): the heading of
 * the stops, how the travel times are reckoned, and the map's caption. One block per site
 * language; the types ask for every word.
 */
import type { SiteLocale } from "../packages/model/src/locales.ts";

export interface TourWords {
  /** The heading over the stops. */
  readonly stops: string;
  /** After a time that is reckoned, not told: "(estimate)". */
  readonly estimate: string;
  /** A voyage shorter than a day even against the wind. */
  readonly underADay: string;
  /** How the times are reckoned, ending where the link to the methodology follows. */
  readonly note: string;
  /** The link to the methodology's section on travel time. */
  readonly how: string;
  /** Legs the text does not trace are left out of the totals. */
  readonly untold: string;
  /** A voyage's km measured through the points at sea it keeps to (a stop's `via`). */
  readonly course: (km: string) => string;
  /** A leg passed within the next leg's told days (Cauda, Acts 27:16 and 27:27). */
  readonly withinNext: string;
  /** The map's lines, for its legend under it: only the kinds the map draws are named. */
  readonly legend: {
    /** Between two of them: "; " (French " ; "). */
    readonly sep: string;
    readonly foot: string;
    readonly sea: string;
    readonly untold: string;
  };
  /** Under the map: the states of the tour's year, and what the numbers are. */
  readonly caption: (year: string, states: string) => string;
}

export const TOUR_WORDS: Record<SiteLocale, TourWords> = {
  en: {
    stops: "The stops",
    estimate: "estimate",
    underADay: "under a day",
    note: "Travel times are estimates of the time on the move, without the stays: on foot 30 km a day, along the Roman roads where a leg has a way by them (Vegetius; the ORBIS model of the Roman world); at sea between a fair wind of about 4 knots and a contrary one of 2, sailing day and night (L. Casson). Where the text gives the days, they are the text’s.",
    how: "How the times are reckoned",
    untold: "legs the text does not trace are not counted",
    withinNext: "within the next leg’s days",
    course: (km) => `≈\u00a0${km}\u00a0km along the course on the map`,
    legend: {
      sep: "; ",
      foot: "solid line: on foot",
      sea: "dashed: by sea",
      untold: "dotted: way not told",
    },
    caption: (year, states) =>
      states
        ? `States (${year}): ${states}. The numbers are the stops.`
        : "The numbers are the stops.",
  },
  ru: {
    stops: "Остановки",
    estimate: "оценка",
    underADay: "меньше суток",
    note: "Время в пути — оценка времени в движении, без остановок: пешком 30 км в день, по римским дорогам, где они есть на участке (Вегеций; модель римского мира ORBIS); по морю — от попутного ветра, около 4 узлов, до встречного, 2 узла, под парусом днём и ночью (Л. Кэссон). Где дни называет текст, указаны они.",
    how: "Как считается время",
    untold: "участки, путь которых текст не называет, не учтены",
    withinNext: "в счёт дней следующего участка",
    course: (km) => `≈\u00a0${km}\u00a0км по курсу на карте`,
    legend: {
      sep: "; ",
      foot: "сплошная линия: пешком",
      sea: "пунктир: по морю",
      untold: "точки: путь не назван",
    },
    caption: (year, states) =>
      states ? `Государства (${year}): ${states}. Цифры — остановки.` : "Цифры — остановки.",
  },
  uk: {
    stops: "Зупинки",
    estimate: "оцінка",
    underADay: "менше доби",
    note: "Час у дорозі — оцінка часу в русі, без зупинок: пішки 30 км на день, римськими дорогами, де вони є на відтинку (Вегецій; модель римського світу ORBIS); морем — від попутного вітру, близько 4 вузлів, до зустрічного, 2 вузли, під вітрилом удень і вночі (Л. Кессон). Де дні називає текст, подано їх.",
    how: "Як рахується час",
    untold: "відтинки, шляху яких текст не називає, не враховано",
    withinNext: "у рахунок днів наступного відтинку",
    course: (km) => `≈\u00a0${km}\u00a0км за курсом на мапі`,
    legend: {
      sep: "; ",
      foot: "суцільна лінія: пішки",
      sea: "пунктир: морем",
      untold: "крапки: шлях не названо",
    },
    caption: (year, states) =>
      states ? `Держави (${year}): ${states}. Цифри — зупинки.` : "Цифри — зупинки.",
  },
  es: {
    stops: "Las paradas",
    estimate: "estimación",
    underADay: "menos de un día",
    note: "Los tiempos de viaje son estimaciones del tiempo en marcha, sin las estancias: a pie, 30 km al día, por las calzadas romanas donde el tramo tiene camino por ellas (Vegecio; el modelo ORBIS del mundo romano); por mar, entre un viento favorable de unos 4 nudos y uno contrario de 2, navegando de día y de noche (L. Casson). Donde el texto da los días, son los del texto.",
    how: "Cómo se calculan los tiempos",
    untold: "no se cuentan los tramos cuyo camino el texto no traza",
    withinNext: "dentro de los días del tramo siguiente",
    course: (km) => `≈\u00a0${km}\u00a0km por el rumbo del mapa`,
    legend: {
      sep: "; ",
      foot: "línea continua: a pie",
      sea: "discontinua: por mar",
      untold: "punteada: camino no indicado",
    },
    caption: (year, states) =>
      states
        ? `Estados (${year}): ${states}. Los números son las paradas.`
        : "Los números son las paradas.",
  },
  pt: {
    stops: "As paradas",
    estimate: "estimativa",
    underADay: "menos de um dia",
    note: "Os tempos de viagem são estimativas do tempo em movimento, sem as permanências: a pé, 30 km por dia, pelas estradas romanas onde o trecho tem caminho por elas (Vegécio; o modelo ORBIS do mundo romano); por mar, entre um vento favorável de cerca de 4 nós e um contrário de 2, navegando dia e noite (L. Casson). Onde o texto dá os dias, são os do texto.",
    how: "Como os tempos são calculados",
    untold: "os trechos cujo caminho o texto não traça não são contados",
    withinNext: "dentro dos dias do trecho seguinte",
    course: (km) => `≈\u00a0${km}\u00a0km pelo rumo do mapa`,
    legend: {
      sep: "; ",
      foot: "linha contínua: a pé",
      sea: "tracejada: por mar",
      untold: "pontilhada: caminho não indicado",
    },
    caption: (year, states) =>
      states
        ? `Estados (${year}): ${states}. Os números são as paradas.`
        : "Os números são as paradas.",
  },
  de: {
    stops: "Die Stationen",
    estimate: "Schätzung",
    underADay: "weniger als ein Tag",
    note: "Die Reisezeiten schätzen die Zeit unterwegs, ohne Aufenthalte: zu Fuß 30 km am Tag, auf den Römerstraßen, wo eine Etappe einen Weg auf ihnen hat (Vegetius; das ORBIS-Modell der römischen Welt); zur See zwischen günstigem Wind mit etwa 4 Knoten und widrigem mit 2, bei Tag und Nacht gesegelt (L. Casson). Wo der Text die Tage nennt, sind es seine.",
    how: "Wie die Zeiten berechnet werden",
    untold: "Etappen, deren Weg der Text nicht nennt, sind nicht mitgezählt",
    withinNext: "in den Tagen der nächsten Etappe enthalten",
    course: (km) => `≈\u00a0${km}\u00a0km auf dem Kurs der Karte`,
    legend: {
      sep: "; ",
      foot: "durchgezogene Linie: zu Fuß",
      sea: "gestrichelt: zur See",
      untold: "gepunktet: Weg nicht genannt",
    },
    caption: (year, states) =>
      states
        ? `Staaten (${year}): ${states}. Die Zahlen sind die Stationen.`
        : "Die Zahlen sind die Stationen.",
  },
  fr: {
    stops: "Les étapes",
    estimate: "estimation",
    underADay: "moins d’un jour",
    note: "Les durées de voyage estiment le temps en route, sans les séjours : à pied, 30 km par jour, par les voies romaines là où l’étape en a une (Végèce ; le modèle ORBIS du monde romain) ; en mer, entre un vent favorable d’environ 4 nœuds et un vent contraire de 2, en naviguant jour et nuit (L. Casson). Là où le texte donne les jours, ce sont les siens.",
    how: "Comment les durées sont calculées",
    untold: "les étapes dont le texte ne retrace pas le chemin ne sont pas comptées",
    withinNext: "compris dans les jours de l’étape suivante",
    course: (km) => `≈\u00a0${km}\u00a0km suivant la route tracée sur la carte`,
    legend: {
      sep: " ; ",
      foot: "trait plein : à pied",
      sea: "tirets : par mer",
      untold: "pointillés : chemin non indiqué",
    },
    caption: (year, states) =>
      states
        ? `États (${year}) : ${states}. Les numéros sont les étapes.`
        : "Les numéros sont les étapes.",
  },
  pl: {
    stops: "Przystanki",
    estimate: "szacunek",
    underADay: "mniej niż dzień",
    note: "Czasy podróży to szacunek czasu w drodze, bez postojów: pieszo 30 km dziennie, rzymskimi drogami, gdzie odcinek ma nimi przejście (Wegecjusz; model świata rzymskiego ORBIS); morzem między pomyślnym wiatrem, około 4 węzłów, a przeciwnym, 2 węzły, pod żaglami dniem i nocą (L. Casson). Gdzie dni podaje tekst, są to dni tekstu.",
    how: "Jak liczony jest czas",
    untold: "odcinków, których drogi tekst nie podaje, nie wliczono",
    withinNext: "w ramach dni następnego odcinka",
    course: (km) => `≈\u00a0${km}\u00a0km kursem z mapy`,
    legend: {
      sep: "; ",
      foot: "linia ciągła: pieszo",
      sea: "przerywana: morzem",
      untold: "kropkowana: droga niepodana",
    },
    caption: (year, states) =>
      states ? `Państwa (${year}): ${states}. Liczby to przystanki.` : "Liczby to przystanki.",
  },
  it: {
    stops: "Le tappe",
    estimate: "stima",
    underADay: "meno di un giorno",
    note: "I tempi di viaggio stimano il tempo in cammino, senza le soste: a piedi 30 km al giorno, lungo le strade romane dove la tappa ne ha una (Vegezio; il modello ORBIS del mondo romano); per mare tra un vento favorevole di circa 4 nodi e uno contrario di 2, navigando giorno e notte (L. Casson). Dove il testo dà i giorni, sono i suoi.",
    how: "Come si calcolano i tempi",
    untold: "le tappe di cui il testo non traccia il percorso non sono contate",
    withinNext: "compreso nei giorni della tappa seguente",
    course: (km) => `≈\u00a0${km}\u00a0km lungo la rotta della mappa`,
    legend: {
      sep: "; ",
      foot: "linea continua: a piedi",
      sea: "tratteggiata: per mare",
      untold: "punteggiata: percorso non indicato",
    },
    caption: (year, states) =>
      states ? `Stati (${year}): ${states}. I numeri sono le tappe.` : "I numeri sono le tappe.",
  },
  nl: {
    stops: "De haltes",
    estimate: "schatting",
    underADay: "minder dan een dag",
    note: "De reistijden schatten de tijd onderweg, zonder verblijf: te voet 30 km per dag, langs de Romeinse wegen waar een etappe er een weg langs heeft (Vegetius; het ORBIS-model van de Romeinse wereld); over zee tussen een gunstige wind van ongeveer 4 knopen en een tegenwind van 2, dag en nacht zeilend (L. Casson). Waar de tekst de dagen geeft, zijn het die van de tekst.",
    how: "Hoe de tijden berekend worden",
    untold: "etappes waarvan de tekst de weg niet geeft, zijn niet meegeteld",
    withinNext: "binnen de dagen van de volgende etappe",
    course: (km) => `≈\u00a0${km}\u00a0km langs de koers op de kaart`,
    legend: {
      sep: "; ",
      foot: "doorgetrokken lijn: te voet",
      sea: "gestreept: over zee",
      untold: "gestippeld: weg niet vermeld",
    },
    caption: (year, states) =>
      states
        ? `Staten (${year}): ${states}. De nummers zijn de haltes.`
        : "De nummers zijn de haltes.",
  },
  cs: {
    stops: "Zastávky",
    estimate: "odhad",
    underADay: "méně než den",
    note: "Doby cesty jsou odhadem času na cestě, bez pobytů: pěšky 30 km denně, po římských silnicích, kde po nich úsek vede (Vegetius; model římského světa ORBIS); po moři mezi příznivým větrem, asi 4 uzly, a protivětrem, 2 uzly, při plavbě ve dne i v noci (L. Casson). Kde dny uvádí text, jsou to jeho.",
    how: "Jak se doby počítají",
    untold: "úseky, jejichž cestu text neuvádí, nejsou započteny",
    withinNext: "v rámci dnů dalšího úseku",
    course: (km) => `≈\u00a0${km}\u00a0km po kurzu na mapě`,
    legend: {
      sep: "; ",
      foot: "plná čára: pěšky",
      sea: "čárkovaně: po moři",
      untold: "tečkovaně: cesta neuvedena",
    },
    caption: (year, states) =>
      states ? `Státy (${year}): ${states}. Čísla jsou zastávky.` : "Čísla jsou zastávky.",
  },
  sv: {
    stops: "Platserna",
    estimate: "uppskattning",
    underADay: "mindre än en dag",
    note: "Restiderna uppskattar tiden i rörelse, utan uppehåll: till fots 30 km om dagen, längs de romerska vägarna där en etapp har en väg längs dem (Vegetius; ORBIS-modellen av den romerska världen); till sjöss mellan medvind på omkring 4 knop och motvind på 2, seglande dag och natt (L. Casson). Där texten anger dagarna är det textens.",
    how: "Hur tiderna räknas",
    untold: "etapper vars väg texten inte anger är inte medräknade",
    withinNext: "inom nästa etapps dagar",
    course: (km) => `≈\u00a0${km}\u00a0km längs kursen på kartan`,
    legend: {
      sep: "; ",
      foot: "heldragen linje: till fots",
      sea: "streckad: till sjöss",
      untold: "prickad: vägen anges inte",
    },
    caption: (year, states) =>
      states ? `Stater (${year}): ${states}. Siffrorna är platserna.` : "Siffrorna är platserna.",
  },
  nb: {
    stops: "Stedene",
    estimate: "anslag",
    underADay: "under en dag",
    note: "Reisetidene anslår tiden i bevegelse, uten opphold: til fots 30 km om dagen, langs de romerske veiene der en etappe har vei langs dem (Vegetius; ORBIS-modellen av den romerske verden); til sjøs mellom medvind på omkring 4 knop og motvind på 2, seilende dag og natt (L. Casson). Der teksten oppgir dagene, er det tekstens.",
    how: "Slik regnes tidene",
    untold: "etapper der teksten ikke oppgir veien, er ikke regnet med",
    withinNext: "innenfor dagene til neste etappe",
    course: (km) => `≈\u00a0${km}\u00a0km langs kursen på kartet`,
    legend: {
      sep: "; ",
      foot: "heltrukket linje: til fots",
      sea: "stiplet: til sjøs",
      untold: "prikket: veien er ikke oppgitt",
    },
    caption: (year, states) =>
      states ? `Stater (${year}): ${states}. Tallene er stedene.` : "Tallene er stedene.",
  },
  da: {
    stops: "Stederne",
    estimate: "skøn",
    underADay: "under en dag",
    note: "Rejsetiderne er et skøn over tiden i bevægelse, uden ophold: til fods 30 km om dagen, ad de romerske veje, hvor en etape har vej ad dem (Vegetius; ORBIS-modellen af den romerske verden); til søs mellem medvind på omkring 4 knob og modvind på 2, sejlende dag og nat (L. Casson). Hvor teksten angiver dagene, er det tekstens.",
    how: "Sådan regnes tiderne",
    untold: "etaper, hvis vej teksten ikke angiver, er ikke medregnet",
    withinNext: "inden for næste etapes dage",
    course: (km) => `≈\u00a0${km}\u00a0km ad kursen på kortet`,
    legend: {
      sep: "; ",
      foot: "fuldt optrukket linje: til fods",
      sea: "stiplet: til søs",
      untold: "prikket: vejen er ikke angivet",
    },
    caption: (year, states) =>
      states ? `Stater (${year}): ${states}. Tallene er stederne.` : "Tallene er stederne.",
  },
  tl: {
    stops: "Ang mga hintuan",
    estimate: "tantiya",
    underADay: "wala pang isang araw",
    note: "Ang mga oras ng paglalakbay ay tantiya ng panahong naglalakbay, hindi kasama ang pananatili: 30 km bawat araw kung naglalakad, sa mga daang Romano kung saan may daan ang bahagi (Vegetius; ang modelong ORBIS ng daigdig ng Roma); sa dagat, mula sa paborableng hangin na mga 4 knot hanggang sa salungat na 2, naglalayag araw at gabi (L. Casson). Kung binabanggit ng teksto ang mga araw, iyon ang ibinibigay.",
    how: "Paano kinukuwenta ang mga oras",
    untold: "hindi binibilang ang mga bahaging hindi binabanggit ng teksto ang daan",
    withinNext: "kasama sa mga araw ng susunod na bahagi",
    course: (km) => `≈\u00a0${km}\u00a0km ayon sa rutang nasa mapa`,
    legend: {
      sep: "; ",
      foot: "buong linya: naglalakad",
      sea: "putul-putol: sa dagat",
      untold: "tuldok-tuldok: hindi binanggit ang daan",
    },
    caption: (year, states) =>
      states
        ? `Mga estado (${year}): ${states}. Ang mga numero ang mga hintuan.`
        : "Ang mga numero ang mga hintuan.",
  },
  sr: {
    stops: "Станице",
    estimate: "процена",
    underADay: "мање од дана",
    note: "Време путовања је процена времена у покрету, без задржавања: пешице 30 км дневно, римским путевима где деоница има пут њима (Вегеције; модел римског света ORBIS); морем између повољног ветра од око 4 чвора и противног од 2, једрећи дању и ноћу (Л. Касон). Где текст наводи дане, наведени су његови.",
    how: "Како се рачуна време",
    untold: "деонице чији пут текст не наводи нису урачунате",
    withinNext: "у оквиру дана следеће деонице",
    course: (km) => `≈\u00a0${km}\u00a0км курсом на мапи`,
    legend: {
      sep: "; ",
      foot: "пуна линија: пешице",
      sea: "испрекидана: морем",
      untold: "тачкаста: пут није наведен",
    },
    caption: (year, states) =>
      states ? `Државе (${year}): ${states}. Бројеви су станице.` : "Бројеви су станице.",
  },
  hu: {
    stops: "A megállók",
    estimate: "becslés",
    underADay: "kevesebb mint egy nap",
    note: "Az útidők az úton töltött idő becslései, a tartózkodások nélkül: gyalog napi 30 km, a római utakon, ahol a szakasznak van útja rajtuk (Vegetius; a római világ ORBIS-modellje); tengeren a mintegy 4 csomós kedvező és a 2 csomós ellenszél között, éjjel-nappal hajózva (L. Casson). Ahol a szöveg megadja a napokat, azok a szövegéi.",
    how: "Hogyan számoljuk az időket",
    untold: "azok a szakaszok, amelyek útját a szöveg nem adja meg, nincsenek beszámítva",
    withinNext: "a következő szakasz napjaiban benne",
    course: (km) => `≈\u00a0${km}\u00a0km a térképen jelölt útvonalon`,
    legend: {
      sep: "; ",
      foot: "folytonos vonal: gyalog",
      sea: "szaggatott: tengeren",
      untold: "pontozott: az út nincs megadva",
    },
    caption: (year, states) =>
      states ? `Államok (${year}): ${states}. A számok a megállók.` : "A számok a megállók.",
  },
  fi: {
    stops: "Pysähdykset",
    estimate: "arvio",
    underADay: "alle päivä",
    note: "Matka-ajat ovat arvioita liikkeellä olon ajasta ilman viipymisiä: jalan 30 km päivässä, roomalaisia teitä pitkin, missä osuudella on tie niitä pitkin (Vegetius; Rooman maailman ORBIS-malli); merellä myötätuulen, noin 4 solmua, ja vastatuulen, 2 solmua, välillä, purjehtien yötä päivää (L. Casson). Missä teksti kertoo päivät, ne ovat tekstin.",
    how: "Miten ajat lasketaan",
    untold: "osuuksia, joiden reittiä teksti ei kerro, ei ole laskettu",
    withinNext: "seuraavan osuuden päivien sisällä",
    course: (km) => `≈\u00a0${km}\u00a0km kartan reittiä pitkin`,
    legend: {
      sep: "; ",
      foot: "yhtenäinen viiva: jalan",
      sea: "katkoviiva: meritse",
      untold: "pisteviiva: reittiä ei kerrota",
    },
    caption: (year, states) =>
      states
        ? `Valtiot (${year}): ${states}. Numerot ovat pysähdykset.`
        : "Numerot ovat pysähdykset.",
  },
  vi: {
    stops: "Các điểm dừng",
    estimate: "ước tính",
    underADay: "chưa đến một ngày",
    note: "Thời gian đi đường là ước tính thời gian di chuyển, không kể những lần lưu lại: đi bộ 30 km mỗi ngày, theo các con đường La Mã ở nơi chặng đường có đường ấy (Vegetius; mô hình ORBIS về thế giới La Mã); đường biển, từ gió thuận khoảng 4 hải lý/giờ đến gió ngược 2 hải lý/giờ, đi thuyền cả ngày lẫn đêm (L. Casson). Nơi văn bản cho biết số ngày, đó là số ngày của văn bản.",
    how: "Cách tính thời gian",
    untold: "không tính những chặng mà văn bản không cho biết đường đi",
    withinNext: "nằm trong số ngày của chặng sau",
    course: (km) => `≈\u00a0${km}\u00a0km theo hải trình trên bản đồ`,
    legend: {
      sep: "; ",
      foot: "nét liền: đi bộ",
      sea: "nét đứt: đường biển",
      untold: "nét chấm: không rõ đường đi",
    },
    caption: (year, states) =>
      states
        ? `Các quốc gia (${year}): ${states}. Các con số là các điểm dừng.`
        : "Các con số là các điểm dừng.",
  },
  ro: {
    stops: "Opririle",
    estimate: "estimare",
    underADay: "sub o zi",
    note: "Duratele de călătorie estimează timpul pe drum, fără popasuri: pe jos 30 km pe zi, pe drumurile romane acolo unde porțiunea are drum pe ele (Vegețiu; modelul ORBIS al lumii romane); pe mare între un vânt prielnic de circa 4 noduri și unul potrivnic de 2, navigând zi și noapte (L. Casson). Acolo unde textul dă zilele, sunt ale textului.",
    how: "Cum se calculează duratele",
    untold: "porțiunile al căror drum textul nu îl arată nu sunt socotite",
    withinNext: "în zilele porțiunii următoare",
    course: (km) => `≈\u00a0${km}\u00a0km pe ruta de pe hartă`,
    legend: {
      sep: "; ",
      foot: "linie continuă: pe jos",
      sea: "întreruptă: pe mare",
      untold: "punctată: drum nearătat",
    },
    caption: (year, states) =>
      states ? `State (${year}): ${states}. Numerele sunt opririle.` : "Numerele sunt opririle.",
  },
  bg: {
    stops: "Спирките",
    estimate: "оценка",
    underADay: "под едно денонощие",
    note: "Времето за път е оценка на времето в движение, без престоите: пеша 30 км на ден, по римските пътища, където отсечката има път по тях (Вегеций; моделът на римския свят ORBIS); по море — между попътен вятър от около 4 възела и насрещен от 2, при плаване денем и нощем (Л. Касън). Където текстът дава дните, те са неговите.",
    how: "Как се изчислява времето",
    untold: "отсечките, чийто път текстът не посочва, не са отчетени",
    withinNext: "в рамките на дните на следващата отсечка",
    course: (km) => `≈\u00a0${km}\u00a0км по курса на картата`,
    legend: {
      sep: "; ",
      foot: "плътна линия: пеша",
      sea: "прекъсната: по море",
      untold: "точки: пътят не е посочен",
    },
    caption: (year, states) =>
      states ? `Държави (${year}): ${states}. Числата са спирките.` : "Числата са спирките.",
  },
};
