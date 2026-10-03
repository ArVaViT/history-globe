import type { Tour } from "@hg/core";

/**
 * A tour's leg as its card draws it: the relief along the way from the stop before, and
 * whether the leg is a walk at all.
 */

/** The Via Appia, 312 BC: the road network (and so a way by road) begins then. */
const ROADS_FROM = -311;
/**
 * Whether a leg may go by the Roman roads: a tour of their time (build-road-legs.ts takes
 * the same ones), or a lesson's stop picked in their time. The same two places walked in
 * Abraham's day had no road.
 */
export const romanLeg = (tour: Tour, step: number): boolean =>
  (tour.id === "lesson" ? (tour.stops[step]?.year ?? tour.year) : tour.year) >= ROADS_FROM;

/**
 * A leg mostly over the sea is a voyage (Paul's to Cyprus and Rome): no walking time, no
 * relief to draw. The relief reads null at sea; a coast crossed at a slant or a bay gives
 * a few nulls on a walk too, so it takes a quarter of the line. A leg with no heights at
 * all is unknown (the tiles did not load), not a voyage: its walking time stays.
 */
export function isVoyage(profile: readonly (number | null)[]): boolean {
  const sea = profile.filter((h) => h === null).length;
  return sea < profile.length && sea / profile.length > 0.25;
}

export interface ProfileShape {
  /** The relief as a filled area, in a `w`×`h` box. */
  readonly area: string;
  /** Its upper edge. */
  readonly line: string;
  /** Sea level's height in the box, when the leg goes below it (the Jordan valley). */
  readonly sea: number | null;
  /**
   * The way's highest point when it is at least `apart` metres above both ends (a ridge
   * crossed), or else its lowest when as far below both (a valley gone down into and up out
   * of); the ends' own heights the card already says.
   */
  readonly peak: {
    /** Across the box, 0–1. */
    readonly at: number;
    /** Down the box, in its units. */
    readonly y: number;
    readonly m: number;
    readonly kind: "high" | "low";
  } | null;
}

/**
 * The shape of a leg's relief. Gaps (the sea, a tile that would not load) take the height
 * of their neighbours, so the line stays whole; a leg with no height at all gives null.
 * The vertical scale starts at the lowest point less a margin, and spans at least 300 m,
 * so a plain does not look like mountains.
 */
export function profileShape(
  values: readonly (number | null)[],
  w: number,
  h: number,
  apart = 150,
): ProfileShape | null {
  const known = values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  const first = known[0];
  const last = known[known.length - 1];
  if (!first || !last || values.length < 2) return null;
  const filled = values.map((v, i) => {
    if (v !== null) return v;
    const before = [...known].reverse().find((k) => k.i < i);
    const after = known.find((k) => k.i > i);
    return before && after
      ? before.v + ((after.v - before.v) * (i - before.i)) / (after.i - before.i)
      : (before ?? after ?? first).v;
  });
  const lo = Math.min(...filled);
  const hi = Math.max(...filled);
  const span = Math.max(hi - lo, 300);
  const base = lo - span * 0.12;
  const top = base + span * 1.3;
  const x = (i: number) => (i / (filled.length - 1)) * w;
  const y = (m: number) => h - ((m - base) / (top - base)) * h;
  const pts = filled.map((m, i) => `${x(i).toFixed(1)},${y(m).toFixed(1)}`);
  const line = `M${pts.join("L")}`;
  const area = `${line}L${w},${h}L0,${h}Z`;
  // Above both ends, or below both: a ridge or a valley on the way.
  const a = filled[0] ?? 0;
  const b = filled[filled.length - 1] ?? 0;
  const at = (m: number) => filled.indexOf(m);
  const peak: ProfileShape["peak"] =
    hi >= Math.max(a, b) + apart
      ? { at: x(at(hi)) / w, y: y(hi), m: hi, kind: "high" }
      : lo <= Math.min(a, b) - apart
        ? { at: x(at(lo)) / w, y: y(lo), m: lo, kind: "low" }
        : null;
  return { area, line, sea: lo < 0 && hi > 0 ? y(0) : null, peak };
}
