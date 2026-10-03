import { BOOKS, formatRef } from "./scripture.ts";
import type { Locale } from "./time.ts";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// English abbreviation → OSIS book, longest first ("1 John" before "John").
const BY_ABBR = new Map(Object.entries(BOOKS).map(([osis, [, en]]) => [en, osis]));
const VERSE_REF = new RegExp(
  `\\b(${[...BY_ABBR.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")}) (\\d+):(\\d+)(?:[-–](\\d+)(?::(\\d+))?)?`,
  "g",
);

/** Ancient authors and works as Russian readers know them; modern books keep their titles. */
const WORKS_RU: readonly (readonly [RegExp, string])[] = [
  // The longer names first: "Herodotus, Histories" before "Herodotus" alone.
  [/\bHerodotus, Histories\b/g, "Геродот, «История»"],
  [/\bPolybius, Histories\b/g, "Полибий, «Всеобщая история»"],
  [/\bPliny the Elder, Natural History\b/g, "Плиний Старший, «Естественная история»"],
  [/\bPliny, Natural History\b/g, "Плиний, «Естественная история»"],
  [/\bDiodorus Siculus, Library\b/g, "Диодор Сицилийский, «Историческая библиотека»"],
  [/\bEusebius, Ecclesiastical History\b/g, "Евсевий, «Церковная история»"],
  [/\bEusebius, Life of Constantine\b/g, "Евсевий, «Жизнь Константина»"],
  [/\bEusebius, Onomasticon\b/g, "Евсевий, «Ономастикон»"],
  [/\bArrian, Anabasis of Alexander\b/g, "Арриан, «Анабасис Александра»"],
  [/\bXenophon, Anabasis\b/g, "Ксенофонт, «Анабасис»"],
  [/\bXenophon, Cyropaedia\b/g, "Ксенофонт, «Киропедия»"],
  [/\bAppian, Civil Wars\b/g, "Аппиан, «Гражданские войны»"],
  [/\bIrenaeus, Against Heresies\b/g, "Ириней, «Против ересей»"],
  [/\bThucydides, History of the Peloponnesian War\b/g, "Фукидид, «История»"],
  [/\bThucydides, History\b/g, "Фукидид, «История»"],
  [/\bLivy, History of Rome\b/g, "Тит Ливий, «История Рима от основания города»"],
  [/\bLivy\b/g, "Тит Ливий"],
  [/\bEpiphanius, Panarion\b/g, "Епифаний, «Панарион»"],
  [/\bHomer, Iliad\b/g, "Гомер, «Илиада»"],
  [/\bSuetonius, Nero\b/g, "Светоний, «Нерон»"],
  [/\bSozomen, Church History\b/g, "Созомен, «Церковная история»"],
  [/\bPlutarch, Pompey\b/g, "Плутарх, «Помпей»"],
  [/\bPhilo, Embassy to Gaius\b/g, "Филон, «О посольстве к Гаю»"],
  [/\bOrigen, Commentary on John\b/g, "Ориген, «Комментарий на Евангелие от Иоанна»"],
  [/\bJustin Martyr, Dialogue with Trypho\b/g, "Иустин Мученик, «Диалог с Трифоном»"],
  [/\bIgnatius, Letter to the Ephesians\b/g, "Игнатий Богоносец, «Послание к ефесянам»"],
  [/\bJordanes, Getica\b/g, "Иордан, «Гетика»"],
  [/\bJerome, Letter\b/g, "Иероним, письмо"],
  [/\bEgeria, Itinerarium\b/g, "Эгерия, «Паломничество»"],
  [/\bBordeaux Pilgrim\b/g, "Бордоский паломник"],
  [/\bAmmianus Marcellinus\b/g, "Аммиан Марцеллин"],
  [/\bAmarna letters\b/g, "Амарнские письма"],
  [/\bAmarna letter\b/g, "Амарнское письмо"],
  [/\bthe Cyrus Cylinder\b/g, "Цилиндр Кира"],
  [/\bCyrus Cylinder\b/g, "Цилиндр Кира"],
  // Royal inscriptions stay as their editions cite them (RINAP, RIMA): a king's name alone
  // in Russian left "Сеннахирим's prism" half in each language.
  [/\bJosephus, Antiquities\b/g, "Флавий, «Иудейские древности»"],
  [/\bJosephus, Jewish War\b/g, "Флавий, «Иудейская война»"],
  [/\bJosephus, Life\b/g, "Флавий, «Жизнь»"],
  [/\bJosephus, Against Apion\b/g, "Флавий, «Против Апиона»"],
  [/\bStrabo, Geography\b/g, "Страбон, «География»"],
  [/\bHerodotus\b/g, "Геродот"],
  [/\bThucydides\b/g, "Фукидид"],
  [/\bArrian, Anabasis\b/g, "Арриан, «Анабасис Александра»"],
  [/\bPlutarch, Alexander\b/g, "Плутарх, «Александр»"],
  [/\bPlutarch\b/g, "Плутарх"],
  [/\bEusebius, Church History\b/g, "Евсевий, «Церковная история»"],
  [/\bSocrates, Church History\b/g, "Сократ Схоластик, «Церковная история»"],
  [/\bEvagrius, Church History\b/g, "Евагрий, «Церковная история»"],
  [/\bTheophanes, Chronicle\b/g, "Феофан, «Хронография»"],
  [/\bJohn Malalas, Chronicle\b/g, "Иоанн Малала, «Хронография»"],
  [/\bProcopius, Buildings\b/g, "Прокопий, «О постройках»"],
  [/\bProcopius, Wars\b/g, "Прокопий, «Войны»"],
  [/\bLactantius, On the Deaths of the Persecutors\b/g, "Лактанций, «О смертях гонителей»"],
  [/\bCassius Dio, Roman History\b/g, "Дион Кассий, «Римская история»"],
  [/\bCassius Dio\b/g, "Дион Кассий"],
  [/\bTacitus, Annals\b/g, "Тацит, «Анналы»"],
  [/\bTacitus, Histories\b/g, "Тацит, «История»"],
  [/\bSuetonius, Claudius\b/g, "Светоний, «Клавдий»"],
  [/\bSuetonius, Augustus\b/g, "Светоний, «Август»"],
  [/\bPausanias, Description of Greece\b/g, "Павсаний, «Описание Эллады»"],
  [/\bRes Gestae Divi Augusti\b/g, "«Деяния божественного Августа»"],
  [/\bWilliam of Tyre, Chronicle\b/g, "Гийом Тирский, «История»"],
  [
    /\bFulcher of Chartres, History of the Expedition to Jerusalem\b/g,
    "Фульхерий Шартрский, «Иерусалимская история»",
  ],
  [/\bBabylonian Chronicle\b/g, "Вавилонская хроника"],
  [/\bNabonidus Chronicle\b/g, "Хроника Набонида"],
  [/\bSumerian King List\b/g, "Шумерский царский список"],
  [/\bEponym Chronicle\b/g, "Хроника эпонимов"],
];

/**
 * A source line as a reader of `locale` reads it: in Russian, Bible references in the
 * Synodal books and numbering ("2 Kgs 25:8-10" → "4 Цар 25:8–10") and the ancient works
 * by their Russian names. Anything not recognised is left as written.
 */
export function localizeCitation(text: string, locale: Locale): string {
  if (locale !== "ru") return text;
  let out = text.replace(
    VERSE_REF,
    (whole, abbr: string, c: string, v: string, a?: string, b?: string) => {
      const book = BY_ABBR.get(abbr);
      if (!book) return whole;
      const start = `${book}.${c}.${v}`;
      const end =
        a === undefined ? "" : b === undefined ? `-${book}.${c}.${a}` : `-${book}.${a}.${b}`;
      try {
        return formatRef(start + end, locale);
      } catch {
        return whole;
      }
    },
  );
  for (const [re, ru] of WORKS_RU) out = out.replace(re, ru);
  return out;
}
