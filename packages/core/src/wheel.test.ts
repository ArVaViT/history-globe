import { describe, expect, it } from "vitest";
import { WheelClassifier, wheelIntent } from "./wheel.ts";

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

describe("WheelClassifier", () => {
  const ev = (deltaY: number, deltaX = 0) => ({ deltaX, deltaY, deltaMode: 0, ctrlKey: false });

  it("keeps a fast two-finger swipe a pan, momentum included", () => {
    const c = new WheelClassifier();
    expect(c.classify(ev(8), 0).kind).toBe("pan");
    expect(c.classify(ev(90), 16).kind).toBe("pan");
    expect(c.classify(ev(120), 32).kind).toBe("pan");
  });

  it("starts a new gesture after the wheel rests", () => {
    const c = new WheelClassifier();
    c.classify(ev(8), 0);
    expect(c.classify(ev(100), 1000).kind).toBe("zoom");
  });

  it("zooms on a Safari or Firefox mouse notch", () => {
    expect(wheelIntent(ev(4.000244140625)).kind).toBe("zoom");
    expect(wheelIntent(ev(-8.00048828125)).kind).toBe("zoom");
  });

  it("pans sideways on a horizontal wheel and on shift + wheel in line mode", () => {
    const line = { deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false, shiftKey: true };
    expect(wheelIntent(line)).toEqual({ kind: "pan", dx: 120, dy: 0 });
    expect(wheelIntent({ deltaX: 2, deltaY: 0, deltaMode: 1, ctrlKey: false }).kind).toBe("pan");
  });
});
