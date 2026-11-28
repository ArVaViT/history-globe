import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  KM_PER_DAY,
  SEA_FAIR_KNOTS,
  SEA_FOUL_KNOTS,
  legTime,
  seaEstimate,
  seaKmPerDay,
  tourTime,
} from "./travel.ts";

describe("travel time", () => {
  it("sails Casson's speeds day and night", () => {
    // 4 knots ≈ 178 km a day, 2 knots ≈ 89 km.
    expect(seaKmPerDay(SEA_FAIR_KNOTS)).toBeCloseTo(177.8, 1);
    expect(seaKmPerDay(SEA_FOUL_KNOTS)).toBeCloseTo(88.9, 1);
  });

  it("gives a voyage a range between a fair wind and a foul one", () => {
    // Troas to Neapolis, about 225 km in a straight line: one to three days (Acts 16:11 took
    // two, Acts 20:6 about five the other way, with a stay on the way likely).
    expect(seaEstimate(225)).toEqual({ min: 1, max: 3 });
    // Fair Havens to Malta, about 830 km.
    expect(seaEstimate(830)).toEqual({ min: 5, max: 10 });
    // Assos to Mitylene, about 45 km: less than a day either way (Acts 20:14).
    expect(seaEstimate(45)).toEqual({ underADay: true });
  });

  it("never makes the fair wind slower than the foul", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 5000, noNaN: true }), (km) => {
        const e = seaEstimate(km);
        if ("underADay" in e) return km <= seaKmPerDay(SEA_FOUL_KNOTS);
        return e.min >= 1 && e.min <= e.max;
      }),
    );
  });

  it("prefers the text's days to an estimate", () => {
    const told = { days: 5, about: true as const, ref: "Acts.20.6" };
    expect(legTime({ km: 225, by: "sea", sailed: told })).toEqual({
      kind: "sea",
      km: 225,
      told,
    });
  });

  it("walks by road where there is one, else in a straight line", () => {
    expect(legTime({ km: 100, road: 150 })).toEqual({
      kind: "foot",
      km: 150,
      byRoad: true,
      time: { days: 5 },
    });
    expect(legTime({ km: 90 })).toEqual({ kind: "foot", km: 90, byRoad: false, time: { days: 3 } });
    expect(legTime({ km: 12 })).toMatchObject({ time: { hours: 2 } });
  });

  it("gives no time to a leg untold, a stay in place or a tour not travelled", () => {
    expect(legTime({ km: 400, by: "untold" })).toEqual({ kind: "untold" });
    expect(legTime({ km: 1 })).toEqual({ kind: "none" });
    expect(legTime({ km: 300 }, false)).toEqual({ kind: "none" });
  });

  it("adds a tour up, on foot and at sea apart", () => {
    const t = tourTime([
      { km: 0 },
      { km: 90, road: 120 },
      { km: 180, road: 240 },
      { km: 225, by: "sea", sailed: { days: 2, ref: "Acts.16.11" } },
      { km: 830, by: "sea" },
      { km: 500, by: "untold" },
    ]);
    expect(t.foot).toEqual({ km: 360, time: { days: 360 / KM_PER_DAY }, floor: false });
    // 2 told + 830 km at 177.8 to 88.9 km a day: 2 + 4.7 → 7, 2 + 9.3 → 12.
    expect(t.sea).toEqual({ min: 7, max: 12, allTold: false });
    expect(t.untold).toBe(1);
  });

  it("says when every voyage's days are the text's", () => {
    const t = tourTime([{ km: 225, by: "sea", sailed: { days: 2, ref: "Acts.16.11" } }]);
    expect(t.sea).toEqual({ min: 2, max: 2, allTold: true });
    expect(t.foot).toBeNull();
  });

  it("prefers the text's days on foot, and adds the rest reckoned", () => {
    const took = { days: 3, about: true as const, ref: "Gen.22.4" };
    expect(legTime({ km: 70, took })).toMatchObject({
      kind: "foot",
      time: { days: 3 },
      told: took,
    });
    expect(tourTime([{ km: 70, took }, { km: 60 }]).foot).toMatchObject({ time: { days: 5 } });
  });

  it("marks a walk measured only in straight lines as a floor", () => {
    expect(tourTime([{ km: 60 }, { km: 90 }]).foot).toMatchObject({ floor: true });
  });

  it("marks a walk a floor when any leg is a straight line, but not for the text's days", () => {
    // One leg by road and one in a straight line: still a floor.
    expect(tourTime([{ km: 60, road: 70 }, { km: 90 }]).foot).toMatchObject({ floor: true });
    // A straight leg whose days the text gives is not reckoned, so not a floor.
    const took = { days: 40, ref: "1Kgs.19.8" };
    expect(
      tourTime([
        { km: 60, road: 70 },
        { km: 400, took },
      ]).foot,
    ).toMatchObject({
      floor: false,
    });
  });

  it("gives a leg within the next leg's told days no time, and counts it in neither total", () => {
    // Fair Havens → Cauda, then the fourteen days to Malta (Acts 27:16, 27:27).
    expect(legTime({ km: 66, by: "sea", withinNext: true })).toEqual({
      kind: "within",
      km: 66,
      sea: true,
    });
    expect(legTime({ km: 40, withinNext: true })).toEqual({ kind: "within", km: 40, sea: false });
    const t = tourTime([
      { km: 0 },
      { km: 66, by: "sea", withinNext: true },
      { km: 885, by: "sea", sailed: { days: 14, about: true, ref: "Acts.27.27" } },
    ]);
    expect(t.sea).toEqual({ min: 14, max: 14, allTold: true });
    expect(t.foot).toBeNull();
    expect(t.within).toBe(1);
    expect(t.untold).toBe(0);
    // Untold stays untold, and a tour not travelled has no time at all.
    expect(legTime({ km: 66, by: "untold", withinNext: true })).toEqual({ kind: "untold" });
    expect(legTime({ km: 66, withinNext: true }, false)).toEqual({ kind: "none" });
  });
});
