import type { Period } from "./periods.ts";
import type { Locale } from "./time.ts";

/**
 * The eras' names in the languages beyond English and Russian (drafted by machine
 * translation 2026-10-10, not yet read by native speakers): the period by id, its
 * "disputed" note by id, and the slider's age bands by their first period.
 */
export const PERIOD_NAMES: Readonly<
  Partial<
    Record<
      Locale,
      {
        readonly periods: Readonly<Record<string, string>>;
        readonly disputed: Readonly<Record<string, string>>;
        readonly ages: Readonly<Record<string, string>>;
      }
    >
  >
> = {
  uk: {
    periods: {
      eb1: "Рання бронза I",
      eb2: "Рання бронза II",
      eb3: "Рання бронза III",
      eb4: "Рання бронза IV",
      mb2: "Середня бронза II",
      lb: "Пізня бронза",
      iron1: "Залізна доба I",
      iron2a: "Залізна доба IIA",
      iron2b: "Залізна доба IIB",
      iron2c: "Залізна доба IIC",
      babylonian: "Вавилонський період",
      persian: "Перський період",
      hellenistic: "Елліністичний період",
      hasmonean: "Хасмонейський період",
      "early-roman": "Ранньоримський період",
      roman: "Римський період",
      "late-roman": "Пізньоримський період",
      byzantine: "Візантійський період",
      "early-islamic": "Ранньоісламський період",
      crusader: "Період хрестоносців",
      mamluk: "Мамлюкський період",
    },
    disputed: {
      mb2: "Час патріархів спірний",
      lb: "Вихід: бл. 1446 або бл. 1270 р. до н. е.",
      iron2a: "Археологи сперечаються щодо дат",
    },
    ages: {
      eb1: "Рання бронза",
      mb2: "Середня бронза",
      lb: "Пізня бронза",
      iron1: "Залізна доба",
      babylonian: "Вавилон",
      persian: "Персія",
      hellenistic: "Еллінізм",
      "early-roman": "Рим",
      byzantine: "Візантія",
      "early-islamic": "Середньовіччя",
    },
  },
  es: {
    periods: {
      eb1: "Bronce Antiguo I",
      eb2: "Bronce Antiguo II",
      eb3: "Bronce Antiguo III",
      eb4: "Bronce Antiguo IV",
      mb2: "Bronce Medio II",
      lb: "Bronce Final",
      iron1: "Hierro I",
      iron2a: "Hierro IIA",
      iron2b: "Hierro IIB",
      iron2c: "Hierro IIC",
      babylonian: "Período babilónico",
      persian: "Período persa",
      hellenistic: "Período helenístico",
      hasmonean: "Período asmoneo",
      "early-roman": "Período romano temprano",
      roman: "Período romano",
      "late-roman": "Período romano tardío",
      byzantine: "Período bizantino",
      "early-islamic": "Período islámico temprano",
      crusader: "Período cruzado",
      mamluk: "Período mameluco",
    },
    disputed: {
      mb2: "La fecha de los patriarcas es discutida",
      lb: "Éxodo: h. 1446 o h. 1270 a. C.",
      iron2a: "Los arqueólogos discuten sus fechas",
    },
    ages: {
      eb1: "Bronce Antiguo",
      mb2: "Bronce Medio",
      lb: "Bronce Final",
      iron1: "Hierro",
      babylonian: "Babilonia",
      persian: "Persia",
      hellenistic: "Helenismo",
      "early-roman": "Roma",
      byzantine: "Bizancio",
      "early-islamic": "Edad Media",
    },
  },
  pt: {
    periods: {
      eb1: "Bronze Antigo I",
      eb2: "Bronze Antigo II",
      eb3: "Bronze Antigo III",
      eb4: "Bronze Antigo IV",
      mb2: "Bronze Médio II",
      lb: "Bronze Final",
      iron1: "Ferro I",
      iron2a: "Ferro IIA",
      iron2b: "Ferro IIB",
      iron2c: "Ferro IIC",
      babylonian: "Período babilónico",
      persian: "Período persa",
      hellenistic: "Período helenístico",
      hasmonean: "Período asmoneu",
      "early-roman": "Período romano inicial",
      roman: "Período romano",
      "late-roman": "Período romano tardio",
      byzantine: "Período bizantino",
      "early-islamic": "Período islâmico inicial",
      crusader: "Período dos cruzados",
      mamluk: "Período mameluco",
    },
    disputed: {
      mb2: "A data dos patriarcas é discutida",
      lb: "Êxodo: c. 1446 ou c. 1270 a.C.",
      iron2a: "Os arqueólogos discutem as suas datas",
    },
    ages: {
      eb1: "Bronze Antigo",
      mb2: "Bronze Médio",
      lb: "Bronze Final",
      iron1: "Ferro",
      babylonian: "Babilónia",
      persian: "Pérsia",
      hellenistic: "Helenismo",
      "early-roman": "Roma",
      byzantine: "Bizâncio",
      "early-islamic": "Idade Média",
    },
  },
  fr: {
    periods: {
      eb1: "Bronze ancien I",
      eb2: "Bronze ancien II",
      eb3: "Bronze ancien III",
      eb4: "Bronze ancien IV",
      mb2: "Bronze moyen II",
      lb: "Bronze récent",
      iron1: "Fer I",
      iron2a: "Fer IIA",
      iron2b: "Fer IIB",
      iron2c: "Fer IIC",
      babylonian: "Période babylonienne",
      persian: "Période perse",
      hellenistic: "Période hellénistique",
      hasmonean: "Période hasmonéenne",
      "early-roman": "Période romaine ancienne",
      roman: "Période romaine",
      "late-roman": "Période romaine tardive",
      byzantine: "Période byzantine",
      "early-islamic": "Période islamique ancienne",
      crusader: "Période des croisés",
      mamluk: "Période mamelouke",
    },
    disputed: {
      mb2: "La date des patriarches est débattue",
      lb: "Exode : vers 1446 ou vers 1270 av. J.-C.",
      iron2a: "Ses dates font débat chez les archéologues",
    },
    ages: {
      eb1: "Bronze ancien",
      mb2: "Bronze moyen",
      lb: "Bronze récent",
      iron1: "Fer",
      babylonian: "Babylone",
      persian: "Perse",
      hellenistic: "Hellénisme",
      "early-roman": "Rome",
      byzantine: "Byzance",
      "early-islamic": "Moyen Âge",
    },
  },
  de: {
    periods: {
      eb1: "Frühbronzezeit I",
      eb2: "Frühbronzezeit II",
      eb3: "Frühbronzezeit III",
      eb4: "Frühbronzezeit IV",
      mb2: "Mittelbronzezeit II",
      lb: "Spätbronzezeit",
      iron1: "Eisenzeit I",
      iron2a: "Eisenzeit IIA",
      iron2b: "Eisenzeit IIB",
      iron2c: "Eisenzeit IIC",
      babylonian: "Babylonische Zeit",
      persian: "Persische Zeit",
      hellenistic: "Hellenistische Zeit",
      hasmonean: "Hasmonäerzeit",
      "early-roman": "Frührömische Zeit",
      roman: "Römische Zeit",
      "late-roman": "Spätrömische Zeit",
      byzantine: "Byzantinische Zeit",
      "early-islamic": "Frühislamische Zeit",
      crusader: "Kreuzfahrerzeit",
      mamluk: "Mamlukenzeit",
    },
    disputed: {
      mb2: "Die Zeit der Patriarchen ist umstritten",
      lb: "Exodus: um 1446 oder um 1270 v. Chr.",
      iron2a: "Die Datierung ist unter Archäologen umstritten",
    },
    ages: {
      eb1: "Frühbronze",
      mb2: "Mittelbronze",
      lb: "Spätbronze",
      iron1: "Eisenzeit",
      babylonian: "Babylon",
      persian: "Persien",
      hellenistic: "Hellenismus",
      "early-roman": "Rom",
      byzantine: "Byzanz",
      "early-islamic": "Mittelalter",
    },
  },
  zh: {
    periods: {
      eb1: "早期青铜时代 I",
      eb2: "早期青铜时代 II",
      eb3: "早期青铜时代 III",
      eb4: "早期青铜时代 IV",
      mb2: "中期青铜时代 II",
      lb: "晚期青铜时代",
      iron1: "铁器时代 I",
      iron2a: "铁器时代 IIA",
      iron2b: "铁器时代 IIB",
      iron2c: "铁器时代 IIC",
      babylonian: "巴比伦时期",
      persian: "波斯时期",
      hellenistic: "希腊化时期",
      hasmonean: "哈斯蒙尼时期",
      "early-roman": "早期罗马时期",
      roman: "罗马时期",
      "late-roman": "晚期罗马时期",
      byzantine: "拜占庭时期",
      "early-islamic": "早期伊斯兰时期",
      crusader: "十字军时期",
      mamluk: "马穆鲁克时期",
    },
    disputed: {
      mb2: "族长时代的年代存在争议",
      lb: "出埃及：约公元前1446年或约前1270年",
      iron2a: "考古学家对其年代存在争议",
    },
    ages: {
      eb1: "早期青铜",
      mb2: "中期青铜",
      lb: "晚期青铜",
      iron1: "铁器时代",
      babylonian: "巴比伦",
      persian: "波斯",
      hellenistic: "希腊化",
      "early-roman": "罗马",
      byzantine: "拜占庭",
      "early-islamic": "中世纪",
    },
  },
};

/** A period's name in the reader's language. */
export function periodName(p: Period, locale: Locale): string {
  if (locale === "en" || locale === "ru") return p.name[locale];
  return PERIOD_NAMES[locale]?.periods[p.id] ?? p.name.en;
}

/** A period's "disputed" note in the reader's language, if it has one. */
export function periodDisputed(p: Period, locale: Locale): string | undefined {
  if (!p.disputed) return undefined;
  if (locale === "en" || locale === "ru") return p.disputed[locale];
  return PERIOD_NAMES[locale]?.disputed[p.id] ?? p.disputed.en;
}

/** An age band's label on the slider (by the age's first period), else the English one. */
export function ageName(
  age: { readonly first: string; readonly en: string; readonly ru: string },
  locale: Locale,
): string {
  if (locale === "en" || locale === "ru") return age[locale];
  return PERIOD_NAMES[locale]?.ages[age.first] ?? age.en;
}
