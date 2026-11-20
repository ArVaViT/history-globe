/**
 * OpenBible place kinds by class. A kind in none of the classes is drawn as a landmark, never
 * dropped from the map (style-expressions.ts isLandmark).
 */
export const AREA_KINDS = ["region", "people group", "island", "mountain range", "natural area"];
export const WATER_KINDS = ["body of water", "river", "canal", "wadi"];
/** Towns and villages. The camps of the Exodus are landmarks with a tent icon. */
export const SETTLEMENT_KINDS = ["settlement"];
/** Built places inside a town: framed close up. */
const STRUCTURE_KINDS = [
  "gate",
  "structure",
  "district in settlement",
  "altar",
  "hall",
  "room",
  "pool",
  "garden",
  "fortification",
  "well",
];

/** Zoom that frames a town or a landmark: kinds framed farther out are areas, seas, rivers. */
export const POINT_ZOOM = 9.4;

/** Zoom that frames a place of this kind: regions need more room than towns. */
export function zoomForKind(kind: string): number {
  switch (kind) {
    case "region":
    case "people group":
      return 6.2;
    case "body of water":
      return 7;
    case "mountain range":
    case "island":
    case "natural area":
      return 7.6;
    case "river":
    case "canal":
      return 8.4;
    default:
      return STRUCTURE_KINDS.includes(kind) ? 13 : POINT_ZOOM;
  }
}
