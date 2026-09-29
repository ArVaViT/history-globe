/** A candidate site as the data build writes it (sites.geojson properties). */
export interface SiteLabelParts {
  readonly label: string;
  readonly tpl?: "same" | "within" | "around" | "region" | "along" | "at" | "name";
  /** Id of the place the label refers to: `a…` ancient (OpenBible), `m…` modern. */
  readonly ref?: string;
  readonly ref_text?: string;
  readonly n?: string;
  readonly unit?: "km" | "m";
}

/**
 * The Russian label of a candidate site, or undefined to keep the English one. The name
 * comes first, in the nominative, so no Russian case endings are needed: "Вавилон, в
 * радиусе 250 км", "то же место, что Авила". An ancient place needs its Synodal name.
 */
export function siteLabelRu(
  p: SiteLabelParts,
  ruName: (placeId: string) => string | undefined,
): string | undefined {
  if (!p.tpl || !p.ref || p.ref_text === undefined) return undefined;
  const ancient = p.ref.startsWith("a");
  const x = ancient ? ruName(p.ref) : p.ref_text;
  if (!x) return undefined;
  const unit = p.unit === "m" ? "м" : "км";
  switch (p.tpl) {
    case "same":
      return `то же место, что ${x}`;
    case "within":
      return `${x}, в радиусе ${p.n ?? ""} ${unit}`;
    case "around":
      return `${x}, в радиусе около ${p.n ?? ""} ${unit}`;
    case "region":
      return `${x}, окрестности`;
    case "along":
      return `${x}, вдоль`;
    case "at":
    case "name":
      // A modern name is the same in both languages: nothing to translate.
      return ancient ? x : undefined;
  }
}
