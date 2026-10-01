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
 * The Russian label of a candidate site, or undefined to keep the English one. Only a
 * reference to an ancient place with a Synodal name is translated; a modern name keeps
 * the whole English label, so no label mixes the two languages. The name stands in the
 * nominative, so no Russian case endings are needed: "Вавилон, в радиусе 250 км".
 */
export function siteLabelRu(
  p: SiteLabelParts,
  ruName: (placeId: string) => string | undefined,
  /** The Russian name of the place the label belongs to: "то же место, что Гай" on Гай
   * says nothing, so it reads as the place's own name in other verses. */
  ownRu?: string,
): string | undefined {
  if (!p.tpl || !p.ref || p.ref_text === undefined) return undefined;
  if (!p.ref.startsWith("a")) return undefined;
  const x = ruName(p.ref);
  if (!x) return undefined;
  const unit = p.unit === "m" ? "м" : "км";
  switch (p.tpl) {
    case "same":
      return x === ownRu ? `там же, где ${x} в других стихах` : `то же место, что ${x}`;
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
