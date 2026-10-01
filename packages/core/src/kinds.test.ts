import { describe, expect, it } from "vitest";
import { placeClass, zoomForKind } from "./kinds.ts";

describe("place kinds", () => {
  it("classifies OpenBible kinds, unknown ones as landmarks", () => {
    expect(placeClass("settlement")).toBe("settlement");
    expect(placeClass("people group")).toBe("area");
    expect(placeClass("body of water")).toBe("water");
    expect(placeClass("mountain")).toBe("landmark");
    expect(placeClass("something new")).toBe("landmark");
  });

  it("frames seas wide and gates close", () => {
    expect(zoomForKind("body of water")).toBeLessThan(zoomForKind("settlement"));
    expect(zoomForKind("gate")).toBeGreaterThan(zoomForKind("settlement"));
  });
});
