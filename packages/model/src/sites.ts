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
