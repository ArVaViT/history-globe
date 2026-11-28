/**
 * How long a tour's legs took, as an estimate the tour pages show beside the distance
 * (content/docs/<lang>/methodology.html, "Distances and travel time").
 *
 * - On foot: 30 km a day (KM_PER_DAY). Vegetius gives the Roman army's ordinary step as 20
 *   Roman miles (about 29.6 km) in five summer hours (Epitoma rei militaris 1.9); the ORBIS
 *   model of the Roman world sets 30 km a day for travellers on foot (Scheidel, Meeks and
 *   Weiland 2012). Along the Roman roads where the leg has a way by them, else in a
 *   straight line, which roads only lengthen: then the time is a floor.
 * - At sea: the days the text gives, where it gives them (Acts 20:6, "in five days"), and
 *   otherwise a range from L. Casson's averages for ancient merchant ships ("Speed under
 *   Sail of Ancient Ships", TAPA 82, 1951, pp. 142–143): about 4 knots with a fair wind
 *   (4–6 over open water, 3–4 along coasts), 2 knots or less against it. Reckoned day and
 *   night over the straight line across the water: a ship that put in for the night, or a
 *   course around a cape, took longer.
 * - A leg the text does not trace (by: "untold") and a tour not travelled get no time.
 * - A leg that falls within the days the text gives for the next one (`within_next`: Cauda,
 *   passed on the fourteen days from Fair Havens, Acts 27:27) has no time of its own and is
 *   counted in neither total, so those days are not counted twice.
 */
import { KM_PER_DAY, walkTime } from "./distance.ts";

/** A knot in km an hour. */
export const KNOT_KM = 1.852;
/** Casson's fair-wind average, the lower end of 4–6 knots over open water (TAPA 82, p. 142). */
export const SEA_FAIR_KNOTS = 4;
/** Casson's average against the wind, "from less than 2 to 2½ knots" (TAPA 82, p. 143). */
export const SEA_FOUL_KNOTS = 2;
/** A day's sailing, day and night, at a speed in knots, in km. */
export const seaKmPerDay = (knots: number): number => knots * KNOT_KM * 24;

/** Shorter legs are the same place, or next door: no time is given (as the distance). */
const MIN_KM = 2;

/** Days the text gives for a voyage: Acts 20:6 «дней в пять», with its verse. */
export interface ToldDays {
  readonly days: number;
  readonly about?: boolean | undefined;
  readonly ref: string;
}

/** A leg as the tour gives it: the straight line, the way by road if any, how it went. */
export interface LegInput {
  /** In a straight line, km. */
  readonly km: number;
  /** Along the Roman roads, km, where the leg has a way by them (road-legs.json). */
  readonly road?: number | null | undefined;
  readonly by?: "sea" | "untold" | undefined;
  /** The days the text gives for a voyage. */
  readonly sailed?: ToldDays | undefined;
  /** The days the text gives for a way on foot (1 Kgs 19:8, forty days to Horeb). */
  readonly took?: ToldDays | undefined;
  /** The leg falls within the next leg's told days: no time of its own. */
  readonly withinNext?: boolean | undefined;
}

/** A sea leg's estimate in whole days, or less than a day either way. */
export type SeaEstimate =
  { readonly min: number; readonly max: number } | { readonly underADay: true };

export type LegTime =
  | { readonly kind: "none" }
  | { readonly kind: "untold" }
  /** Within the next leg's told days: how it went, and no time of its own. */
  | { readonly kind: "within"; readonly km: number; readonly sea: boolean }
  | {
      readonly kind: "foot";
      readonly km: number;
      /** Measured along the Roman roads (else in a straight line: a floor). */
      readonly byRoad: boolean;
      readonly time: { readonly hours: number } | { readonly days: number };
      /** The text's own days for the way, preferred to the reckoning. */
      readonly told?: ToldDays;
    }
  | { readonly kind: "sea"; readonly km: number; readonly told: ToldDays }
  | { readonly kind: "sea"; readonly km: number; readonly estimate: SeaEstimate };

/** The days between a fair wind and a foul one over a distance at sea. */
export function seaEstimate(km: number): SeaEstimate {
  const fair = km / seaKmPerDay(SEA_FAIR_KNOTS);
  const foul = km / seaKmPerDay(SEA_FOUL_KNOTS);
  if (foul <= 1) return { underADay: true };
  const min = Math.max(1, Math.round(fair));
  return { min, max: Math.max(min, Math.ceil(foul)) };
}

/** How long one leg took: walked, sailed (the text's days or an estimate), or not said. */
export function legTime(leg: LegInput, walked = true): LegTime {
  if (!walked || leg.km < MIN_KM) return { kind: "none" };
  if (leg.by === "untold") return { kind: "untold" };
  if (leg.withinNext) return { kind: "within", km: leg.road ?? leg.km, sea: leg.by === "sea" };
  if (leg.by === "sea")
    return leg.sailed
      ? { kind: "sea", km: leg.km, told: leg.sailed }
      : { kind: "sea", km: leg.km, estimate: seaEstimate(leg.km) };
  const road = leg.road ?? null;
  const km = road ?? leg.km;
  return leg.took
    ? { kind: "foot", km, byRoad: road !== null, time: { days: leg.took.days }, told: leg.took }
    : { kind: "foot", km, byRoad: road !== null, time: walkTime(km) };
}

/** A whole tour's time: on foot and at sea, apart, and the legs left without a time. */
export interface TourTime {
  /** Km walked (by road where known), and the days at KM_PER_DAY; null when none. */
  readonly foot: {
    readonly km: number;
    readonly time: { readonly hours: number } | { readonly days: number };
    /** Some walked leg had no way by road and no days from the text: the time is a floor. */
    readonly floor: boolean;
  } | null;
  /** Days at sea: the text's where it gives them, the estimates' range elsewhere. */
  readonly sea: {
    readonly min: number;
    readonly max: number;
    /** Every voyage's days are the text's. */
    readonly allTold: boolean;
  } | null;
  /** Legs the text does not trace: not counted. */
  readonly untold: number;
  /** Legs within the next leg's told days: not counted apart. */
  readonly within: number;
}

export function tourTime(legs: readonly LegInput[], walked = true): TourTime {
  let footKm = 0;
  let footTold = 0;
  let floor = false;
  let anyFoot = false;
  let seaMin = 0;
  let seaMax = 0;
  let anySea = false;
  let allTold = true;
  let untold = 0;
  let within = 0;
  for (const leg of legs) {
    const t = legTime(leg, walked);
    if (t.kind === "untold") untold++;
    else if (t.kind === "within") within++;
    else if (t.kind === "foot") {
      anyFoot = true;
      if (t.told) footTold += t.told.days;
      else {
        footKm += t.km;
        // One leg measured only in a straight line makes the whole a floor.
        floor ||= !t.byRoad;
      }
    } else if (t.kind === "sea") {
      anySea = true;
      if ("told" in t) {
        seaMin += t.told.days;
        seaMax += t.told.days;
      } else {
        allTold = false;
        seaMin += t.km / seaKmPerDay(SEA_FAIR_KNOTS);
        seaMax += t.km / seaKmPerDay(SEA_FOUL_KNOTS);
      }
    }
  }
  const min = Math.max(1, Math.round(seaMin));
  return {
    foot: anyFoot
      ? {
          km: footKm,
          // The text's days, and the rest reckoned: whole days once the text gives some.
          time:
            footTold > 0 ? { days: footTold + Math.round(footKm / KM_PER_DAY) } : walkTime(footKm),
          floor,
        }
      : null,
    sea: anySea ? { min, max: Math.max(min, Math.ceil(seaMax)), allTold } : null,
    untold,
    within,
  };
}

export { KM_PER_DAY };
