import { isDeuterocanon, type Locale } from "@hg/model";

/**
 * A verse or passage on BibleGateway. It reads OSIS references as they are and keeps
 * the English numbering, showing the Synodal verse under it (RUSV: Ps 68:15 is shown
 * as "(67-16) Гора Божия…"), so no conversion is needed.
 */
/** Bible Gateway's edition for each language's readers (its own codes). */
const GATEWAY_VERSION: Readonly<Partial<Record<Locale, string>>> = {
  ru: "RUSV",
  uk: "UKR",
  es: "RVR1960",
  pt: "ARC",
  fr: "LSG",
  de: "LUTH1545",
  it: "NR2006",
  nl: "HTB",
  pl: "UBG",
  cs: "B21",
  zh: "CUVS",
};

export function verseUrl(osis: string, locale: Locale): string {
  // 1-2 Maccabees are in neither of those: the Synodal text at Azbyka (its own address form,
  // 1Mac.4:36-59), in English a version with the Apocrypha.
  if (isDeuterocanon(osis)) {
    if (locale === "ru") {
      const [a = "", b] = osis.split("-");
      const [book = "", c = "", v = ""] = a.split(".");
      const end = b?.split(".") ?? [];
      const tail =
        end.length === 3
          ? end[1] === c
            ? `-${end[2] ?? ""}`
            : `-${end[1] ?? ""}:${end[2] ?? ""}`
          : "";
      return `https://azbyka.ru/biblia/?${book.replace("Macc", "Mac")}.${c}:${v}${tail}`;
    }
    return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(osis)}&version=NRSVUE`;
  }
  const version = GATEWAY_VERSION[locale] ?? "ESV";
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(osis)}&version=${version}`;
}

/** The place's point on Google Maps: where it is today. */
export function mapsUrl([lon, lat]: readonly [number, number]): string {
  return `https://www.google.com/maps/search/?api=1&query=${String(lat)},${String(lon)}`;
}
