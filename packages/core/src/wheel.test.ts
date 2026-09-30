import { describe, expect, it } from "vitest";
import { wheelIntent } from "./wheel.ts";

describe("wheelIntent", () => {
  it("pans with two fingers on a trackpad", () => {
    expect(wheelIntent({ deltaX: 3, deltaY: 12, deltaMode: 0, ctrlKey: false })).toEqual({
      kind: "pan",
      dx: 3,
      dy: 12,
    });
  });

  it("zooms on a pinch (ctrlKey), in towards the fingers spreading", () => {
    const got = wheelIntent({ deltaX: 0, deltaY: -5, deltaMode: 0, ctrlKey: true });
    expect(got.kind).toBe("zoom");
    expect(got.kind === "zoom" && got.dz > 0).toBe(true);
  });

  it("zooms with a mouse wheel: whole lines or big vertical steps", () => {
    expect(wheelIntent({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false }).kind).toBe("zoom");
    expect(wheelIntent({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false }).kind).toBe("zoom");
  });
});
