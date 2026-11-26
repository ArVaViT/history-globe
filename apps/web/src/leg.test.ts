// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { isVoyage, profileShape, roadKm, romanLeg } from "./leg";

describe("isVoyage", () => {
  it("takes a leg mostly at sea for a voyage", () => {
    expect(isVoyage([10, null, null, null, 5])).toBe(true);
    // No heights at all: the tiles did not load, which says nothing of the sea.
    expect(isVoyage([null, null, null])).toBe(false);
    expect(isVoyage([10, 20, null, 30, 40, 50, 60, 70])).toBe(false);
    expect(isVoyage([])).toBe(false);
  });
});

describe("profileShape", () => {
  it("finds a ridge crossed between two low ends", () => {
    const s = profileShape([0, 300, 800, 300, 0], 100, 40);
    expect(s?.peak).toMatchObject({ at: 0.5, m: 800, kind: "high" });
  });

  it("finds a valley gone down into", () => {
    const s = profileShape([750, 0, -390, 0, 600], 100, 40);
    expect(s?.peak?.kind).toBe("low");
    expect(s?.peak?.m).toBe(-390);
    expect(s?.sea).not.toBeNull();
  });

  it("says nothing of a climb, steady or not", () => {
    // Jericho up to Jerusalem or Ai: the ends say it all.
    expect(profileShape([-250, 0, 250, 500, 750], 100, 40)?.peak).toBeNull();
    expect(profileShape([-209, -100, 0, 130, 120, 300, 831], 100, 40)?.peak).toBeNull();
  });

  it("bridges gaps and gives null without heights", () => {
    const s = profileShape([100, null, 300], 100, 40);
    expect(s?.line.split("L")).toHaveLength(3);
    expect(profileShape([null, null], 100, 40)).toBeNull();
  });

  it("keeps a plain flat", () => {
    const s = profileShape([10, 20, 15], 100, 40);
    const ys = (s?.line ?? "")
      .replace("M", "")
      .split("L")
      .map((p) => Number(p.split(",")[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4);
  });
});

describe("romanLeg", () => {
  const stop = (year?: number) => ({
    placeId: "a15257a",
    at: [35, 31] as const,
    ref: "Acts.1.1",
    note: {},
    ...(year === undefined ? {} : { year }),
  });
  it("gives the roads to a tour of their time, not to Abraham's", () => {
    expect(romanLeg({ id: "paul-1", year: 47, stops: [stop(), stop()] }, 1)).toBe(true);
    expect(romanLeg({ id: "samaria-falls", year: -730, stops: [stop(), stop()] }, 1)).toBe(false);
  });
  it("judges a lesson's stop by the year it was picked at", () => {
    const lesson = { id: "lesson", year: 47, stops: [stop(47), stop(-1000), stop()] };
    expect(romanLeg(lesson, 1)).toBe(false);
    expect(romanLeg(lesson, 2)).toBe(true);
  });
});

describe("roadKm", () => {
  const stop = (placeId: string, more: { sea?: boolean; year?: number } = {}) => ({
    placeId,
    at: [35, 31] as const,
    ref: "Acts.1.1",
    note: {},
    ...more,
  });
  const legs = { tours: { "paul-1": [null, 120, null] }, pairs: { "a>b": 40, "b>c": 70 } };

  it("takes the tour's own leg, else the two places' way in the roads' time", () => {
    const tour = { id: "paul-1", year: 47, stops: [stop("x"), stop("y"), stop("b"), stop("c")] };
    expect(roadKm(legs, tour, 1)).toBe(120);
    expect(roadKm(legs, tour, 3)).toBe(70);
    expect(roadKm(legs, tour, 0)).toBeNull();
    // The same for the card and the sheet, a lesson or not.
    const lesson = { id: "lesson", year: 47, stops: [stop("a"), stop("b")] };
    expect(roadKm(legs, lesson, 1)).toBe(40);
  });

  it("gives no road at sea, on a tour not walked, or before the roads", () => {
    const sea = { id: "t", year: 47, stops: [stop("a"), stop("b", { sea: true })] };
    expect(roadKm(legs, sea, 1)).toBeNull();
    const told = { id: "t", year: 47, walked: false, stops: [stop("a"), stop("b")] };
    expect(roadKm(legs, told, 1)).toBeNull();
    const early = { id: "t", year: -1000, stops: [stop("a"), stop("b")] };
    expect(roadKm(legs, early, 1)).toBeNull();
  });
});
