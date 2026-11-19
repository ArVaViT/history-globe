import { describe, expect, it } from "vitest";
import { zoomForKind } from "./kinds.ts";

describe("place kinds", () => {
  it("frames seas wide and gates close", () => {
    expect(zoomForKind("body of water")).toBeLessThan(zoomForKind("settlement"));
    expect(zoomForKind("gate")).toBeGreaterThan(zoomForKind("settlement"));
  });
});
