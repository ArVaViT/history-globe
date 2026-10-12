import { localeData } from "./locale-data.ts";

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
 * A candidate site's label in a language other than English, from the language's templates
 * (locale-data.ts) and the name its names file gives the ref: a biblical place, or a modern
 * one. Undefined where the language or the name is missing, so the whole English label
 * stays and no label mixes two languages. The name stands in the nominative, so no case
 * endings are needed: "Вавилон, в радиусе 250 км". `own` is the name of the place the label
 * belongs to: "там же, где Гай" on Гай says nothing, so it reads as its name in other verses.
 */
export function siteLabelIn(
  locale: string,
  p: SiteLabelParts,
  name: (placeId: string) => string | undefined,
  own?: string,
): string | undefined {
  const w = localeData(locale)?.site;
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
