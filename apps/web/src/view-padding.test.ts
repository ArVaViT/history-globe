import { describe, expect, it } from "vitest";
import { viewPadding } from "./view-padding.ts";

describe("viewPadding", () => {
  it("keeps a phone's place between the header and the card", () => {
    expect(viewPadding(390, 844)).toEqual({ top: 64, bottom: 464, left: 0, right: 0 });
  });

  it("puts the place beside the card on a wide screen, below it on a narrower one", () => {
    expect(viewPadding(1440, 900)).toEqual({ top: 0, bottom: 140, left: 356, right: 396 });
    expect(viewPadding(1024, 768)).toEqual({ top: 360, bottom: 140, left: 356, right: 0 });
  });

  it("puts the place beside the card on a phone on its side, clear of the timeline", () => {
    const p = viewPadding(844, 390);
    expect(p).toEqual({ top: 0, bottom: 140, left: 356, right: 396 });
    // The open strip between the panels and the card.
    expect(p.left + (844 - p.left - p.right) / 2).toBe(402);
  });
});
