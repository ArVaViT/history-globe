import { describe, expect, it } from "vitest";
import { viewPadding } from "./view-padding.ts";

describe("viewPadding", () => {
  it("keeps a phone's place between the header and the card on the timeline", () => {
    // 124 px of timeline, the card 20 px above it and up to 48% of the screen: 549 px.
    expect(viewPadding(390, 844)).toEqual({ top: 64, bottom: 549, left: 0, right: 0 });
    // A taller timeline (the phone's, with its period line) pushes the open strip up.
    expect(viewPadding(390, 844, false, 230).bottom).toBe(655);
  });

  it("puts the place beside the card on a wide screen, below it on a narrower one", () => {
    expect(viewPadding(1440, 900)).toEqual({ top: 0, bottom: 190, left: 376, right: 452 });
    expect(viewPadding(1024, 768)).toEqual({ top: 360, bottom: 190, left: 376, right: 0 });
  });

  it("puts the place beside the card on a phone on its side, clear of the timeline", () => {
    const p = viewPadding(844, 390);
    // Both sides shrink to fit the width, in proportion.
    expect(p).toEqual({ top: 0, bottom: 190, left: 356, right: 428 });
    // The open strip between the panels and the card.
    expect(p.left + (844 - p.left - p.right) / 2).toBe(386);
    // Narrower still, the strip shrinks but stays between the column and the card.
    const q = viewPadding(780, 480);
    const x = q.left + (780 - q.left - q.right) / 2;
    expect(x).toBeGreaterThan(q.left);
    expect(x).toBeLessThan(780 - q.right);
  });

  it("keeps no room for a card that is not open", () => {
    expect(viewPadding(1200, 760, false, 124, false)).toEqual({
      top: 0,
      bottom: 190,
      left: 376,
      right: 0,
    });
  });

  it("leaves no room for a column when embedded", () => {
    expect(viewPadding(1200, 800, true).left).toBe(0);
    expect(viewPadding(1200, 800).left).toBeGreaterThan(0);
  });

  it("leaves a phone's map to a chapter when no card is open", () => {
    expect(viewPadding(390, 844, false, 124, false, true)).toEqual({
      top: 120,
      bottom: 148,
      left: 0,
      right: 0,
    });
    // A card open keeps its room, as before.
    expect(viewPadding(390, 844, false, 124, true, true)).toEqual(viewPadding(390, 844));
  });

  it("gives an embedded map the frame, clear of the chip and the folded timeline", () => {
    // No card: only the chapter's chip above and the timeline's line below.
    expect(viewPadding(800, 480, true, 48, false)).toEqual({
      top: 56,
      bottom: 72,
      left: 0,
      right: 0,
    });
    // A card open: beside it, and above the timeline as measured.
    expect(viewPadding(1200, 800, true, 48, true)).toEqual({
      top: 56,
      bottom: 72,
      left: 0,
      right: 492,
    });
  });
});
