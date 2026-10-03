import { describe, expect, it } from "vitest";
import { distanceKm, roundKm, routeKm, walkTime } from "./distance";

const jerusalem = [35.2345, 31.7767] as const;
const damascus = [36.3064, 33.5131] as const;
const rome = [12.4964, 41.9028] as const;

describe("distance", () => {
  it("measures a great circle", () => {
    // Jerusalem → Damascus is about 218 km in a straight line, → Rome about 2300.
    expect(distanceKm(jerusalem, damascus)).toBeGreaterThan(212);
    expect(distanceKm(jerusalem, damascus)).toBeLessThan(224);
    expect(distanceKm(jerusalem, rome)).toBeGreaterThan(2250);
    expect(distanceKm(jerusalem, rome)).toBeLessThan(2350);
    expect(distanceKm(jerusalem, jerusalem)).toBe(0);
  });

  it("rounds to what a straight line can claim", () => {
    expect(roundKm(7.4)).toBe(7);
    expect(roundKm(0.2)).toBe(1);
    expect(roundKm(218.4)).toBe(220);
    expect(roundKm(2296)).toBe(2300);
  });

  it("adds up a route", () => {
    expect(routeKm([jerusalem, damascus, jerusalem])).toBeCloseTo(
      2 * distanceKm(jerusalem, damascus),
    );
    expect(routeKm([jerusalem])).toBe(0);
  });
});

describe("walkTime", () => {
  it("counts hours under a day's walk and days beyond it", () => {
    expect(walkTime(9)).toEqual({ hours: 2 });
    expect(walkTime(2)).toEqual({ hours: 1 });
    expect(walkTime(215)).toEqual({ days: 7 });
    expect(walkTime(31)).toEqual({ days: 1 });
  });
});
