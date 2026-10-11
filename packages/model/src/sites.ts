/** A candidate site as the data build writes it (sites.geojson properties). */
export interface SiteLabelParts {
  readonly label: string;
  readonly tpl?: "same" | "same_name" | "within" | "around" | "region" | "along" | "at" | "name";
  /** Id of the place the label refers to: `a…` ancient (OpenBible), `m…` modern. */
  readonly ref?: string;
  readonly ref_text?: string;
  readonly n?: string;
  readonly unit?: "km" | "m";
}

/**
 * The Russian label of a candidate site, or undefined to keep the English one. The ref is
 * translated when it has a Russian form: a biblical place by its Synodal name, a modern
 * one by content/modern-names.yaml; otherwise the whole English label stays, so no label
 * mixes the two languages. The name stands in the nominative, so no Russian case endings
 * are needed: "Вавилон, в радиусе 250 км".
 */
export function siteLabelRu(
  p: SiteLabelParts,
  ruName: (placeId: string) => string | undefined,
  /** The Russian name of the place the label belongs to: "там же, где Гай" on Гай
   * says nothing, so it reads as the place's own name in other verses. */
  ownRu?: string,
): string | undefined {
  if (!p.tpl || !p.ref || p.ref_text === undefined) return undefined;
  // The ref is a biblical place (a…, its Synodal name) or a modern one (m…, its Russian
  // form from content/modern-names.yaml); either way the lookup decides.
  const x = ruName(p.ref);
  if (!x) return undefined;
  const unit = p.unit === "m" ? "м" : "км";
  switch (p.tpl) {
    case "same":
      return x === ownRu ? `там же, где ${x} в других стихах` : `там же, где ${x}`;
    case "same_name":
      return `там же, где ${x} в других стихах`;
    case "within":
      return `${x}, в радиусе ${p.n ?? ""} ${unit}`;
    case "around":
      return `${x}, в радиусе около ${p.n ?? ""} ${unit}`;
    case "region":
      return `${x}, окрестности`;
    case "along":
      return `вдоль: ${x}`;
    case "at":
    case "name":
      return x;
  }
}

/** The same templates in the other languages: the name always in its plain form. */
const SITE_WORDS: Readonly<
  Record<
    string,
    {
      same: (x: string) => string;
      sameName: (x: string) => string;
      within: (x: string, n: string, u: string) => string;
      around: (x: string, n: string, u: string) => string;
      region: (x: string) => string;
      along: (x: string) => string;
      km: string;
      m: string;
    }
  >
> = {
  uk: {
    same: (x) => `там само, де ${x}`,
    sameName: (x) => `там само, де ${x} в інших віршах`,
    within: (x, n, u) => `${x}, у радіусі ${n} ${u}`,
    around: (x, n, u) => `${x}, у радіусі близько ${n} ${u}`,
    region: (x) => `${x}, околиці`,
    along: (x) => `уздовж: ${x}`,
    km: "км",
    m: "м",
  },
  es: {
    same: (x) => `en el mismo lugar que ${x}`,
    sameName: (x) => `en el mismo lugar que ${x} en otros versículos`,
    within: (x, n, u) => `${x}, en un radio de ${n} ${u}`,
    around: (x, n, u) => `${x}, en un radio de unos ${n} ${u}`,
    region: (x) => `${x}, alrededores`,
    along: (x) => `a lo largo de: ${x}`,
    km: "km",
    m: "m",
  },
  pt: {
    same: (x) => `no mesmo lugar que ${x}`,
    sameName: (x) => `no mesmo lugar que ${x} em outros versículos`,
    within: (x, n, u) => `${x}, num raio de ${n} ${u}`,
    around: (x, n, u) => `${x}, num raio de cerca de ${n} ${u}`,
    region: (x) => `${x}, arredores`,
    along: (x) => `ao longo de: ${x}`,
    km: "km",
    m: "m",
  },
  fr: {
    same: (x) => `au même endroit que ${x}`,
    sameName: (x) => `au même endroit que ${x} dans d’autres versets`,
    within: (x, n, u) => `${x}, dans un rayon de ${n} ${u}`,
    around: (x, n, u) => `${x}, dans un rayon d’environ ${n} ${u}`,
    region: (x) => `${x}, environs`,
    along: (x) => `le long de : ${x}`,
    km: "km",
    m: "m",
  },
  de: {
    same: (x) => `am selben Ort wie ${x}`,
    sameName: (x) => `am selben Ort wie ${x} in anderen Versen`,
    within: (x, n, u) => `${x}, im Umkreis von ${n} ${u}`,
    around: (x, n, u) => `${x}, im Umkreis von etwa ${n} ${u}`,
    region: (x) => `${x}, Umgebung`,
    along: (x) => `entlang: ${x}`,
    km: "km",
    m: "m",
  },
  it: {
    same: (x) => `nello stesso luogo di ${x}`,
    sameName: (x) => `nello stesso luogo di ${x} in altri versetti`,
    within: (x, n, u) => `${x}, entro ${n} ${u}`,
    around: (x, n, u) => `${x}, entro circa ${n} ${u}`,
    region: (x) => `${x}, dintorni`,
    along: (x) => `lungo: ${x}`,
    km: "km",
    m: "m",
  },
  nl: {
    same: (x) => `op dezelfde plaats als ${x}`,
    sameName: (x) => `op dezelfde plaats als ${x} in andere verzen`,
    within: (x, n, u) => `${x}, binnen ${n} ${u}`,
    around: (x, n, u) => `${x}, binnen ongeveer ${n} ${u}`,
    region: (x) => `${x}, omgeving`,
    along: (x) => `langs: ${x}`,
    km: "km",
    m: "m",
  },
  pl: {
    same: (x) => `w tym samym miejscu co ${x}`,
    sameName: (x) => `w tym samym miejscu co ${x} w innych wersetach`,
    within: (x, n, u) => `${x}, w promieniu ${n} ${u}`,
    around: (x, n, u) => `${x}, w promieniu około ${n} ${u}`,
    region: (x) => `${x} i okolice`,
    along: (x) => `trasa: ${x}`,
    km: "km",
    m: "m",
  },
  cs: {
    same: (x) => `na stejném místě jako ${x}`,
    sameName: (x) => `na stejném místě jako ${x} v jiných verších`,
    within: (x, n, u) => `${x}, v okruhu ${n} ${u}`,
    around: (x, n, u) => `${x}, v okruhu asi ${n} ${u}`,
    region: (x) => `${x} a okolí`,
    along: (x) => `trasa: ${x}`,
    km: "km",
    m: "m",
  },
  zh: {
    same: (x) => `与${x}同地`,
    sameName: (x) => `与其他经文中的${x}同地`,
    within: (x, n, u) => `${x}，半径${n}${u}内`,
    around: (x, n, u) => `${x}，半径约${n}${u}内`,
    region: (x) => `${x}一带`,
    along: (x) => `沿：${x}`,
    km: "公里",
    m: "米",
  },
};

/**
 * siteLabelRu for another language (uk, es, pt, fr, de, it, nl, pl, cs, zh): the same templates, the name
 * as the language's names file gives it. Undefined where the language or the name is missing.
 */
export function siteLabelIn(
  locale: string,
  p: SiteLabelParts,
  name: (placeId: string) => string | undefined,
  own?: string,
): string | undefined {
  const w = SITE_WORDS[locale];
  if (!w || !p.tpl || !p.ref || p.ref_text === undefined) return undefined;
  const x = name(p.ref);
  if (!x) return undefined;
  const unit = p.unit === "m" ? w.m : w.km;
  const n = p.n ?? "";
  switch (p.tpl) {
    case "same":
      return x === own ? w.sameName(x) : w.same(x);
    case "same_name":
      return w.sameName(x);
    case "within":
      return w.within(x, n, unit);
    case "around":
      return w.around(x, n, unit);
    case "region":
      return w.region(x);
    case "along":
      return w.along(x);
    case "at":
    case "name":
      return x;
  }
}

/**
 * How sure the card may sound about where a place was, when it is not disputed: OpenBible
 * scores Capernaum's Tell Hum 842 but Gilgal's Khirbet el-Mefjir 556 and Golgotha's
 * traditional site 426, and none has a serious rival. Thresholds checked against sites
 * scholars agree on (Capernaum, Beersheba, Jezreel: 800 and above) and ones they do not
 * (Gilgal, Eglon: below 600). With no score at all the card claims nothing ("unknown").
 */
export function siteCertainty(place: {
  readonly disputed: boolean;
  readonly confidence?: number | undefined;
}): "disputed" | "agreed" | "likely" | "tentative" | "unknown" {
  if (place.disputed) return "disputed";
  const c = place.confidence;
  if (c === undefined) return "unknown";
  if (c >= 800) return "agreed";
  return c >= 600 ? "likely" : "tentative";
}
