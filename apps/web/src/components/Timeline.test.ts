import { describe, expect, it } from "vitest";
import { clampView, FULL_VIEW, ticksFor, zoomView } from "./Timeline";

describe("the timeline window", () => {
  it("zooms around the pointer and keeps inside the range", () => {
    const v = zoomView(FULL_VIEW, 0.1, -999);
    expect(v.to - v.from).toBeCloseTo(209.9, 5);
    expect(v.from).toBeLessThan(-999);
    expect(v.to).toBeGreaterThan(-999);
    expect(zoomView(FULL_VIEW, 2, 0)).toEqual(FULL_VIEW);
  });

  it("never narrows below twenty years or slides past the ends", () => {
    expect(zoomView({ from: -1000, to: -980 }, 0.1, -990)).toEqual({ from: -1000, to: -980 });
    expect(clampView(-5000, 100)).toEqual({ from: FULL_VIEW.from, to: FULL_VIEW.from + 100 });
    expect(clampView(5000, 100)).toEqual({ from: FULL_VIEW.to - 100, to: FULL_VIEW.to });
  });

  it("labels round years as written, at most six of them", () => {
    expect(ticksFor(FULL_VIEW)).toEqual([-1999, -1499, -999, -499]);
    const near = ticksFor({ from: -969, to: -930 });
    expect(near.length).toBeLessThanOrEqual(6);
    // 970, 960, 950, 940 BC as written: astronomical -969, -959, -949, -939.
    expect(near).toEqual([-969, -959, -949, -939]);
  });
});
