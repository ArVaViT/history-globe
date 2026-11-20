import { describe, expect, it } from "vitest";
import { sitesFrame, viewPadding } from "./view-padding";

describe("viewPadding", () => {
  it("keeps a phone's place between the header and the card on the timeline", () => {
    // 124 px of timeline, the card 20 px above it and up to 48% of the screen: 549 px.
    expect(viewPadding({ w: 390, h: 844 })).toEqual({ top: 64, bottom: 549, left: 0, right: 0 });
    // A taller timeline (the phone's, with its period line) pushes the open strip up.
    expect(viewPadding({ w: 390, h: 844, embed: false, timeline: 230 }).bottom).toBe(655);
  });

  it("puts the place beside the card on a wide screen, below it on a narrower one", () => {
    expect(viewPadding({ w: 1440, h: 900 })).toEqual({
      top: 0,
      bottom: 190,
      left: 376,
      right: 452,
    });
    expect(viewPadding({ w: 1024, h: 768 })).toEqual({
      top: 360,
      bottom: 190,
      left: 376,
      right: 0,
    });
  });

  it("puts the place beside the card on a phone on its side, clear of the timeline", () => {
    const p = viewPadding({ w: 844, h: 390 });
    // Both sides shrink to fit the width, in proportion.
    expect(p).toEqual({ top: 0, bottom: 190, left: 356, right: 428 });
    // The open strip between the panels and the card.
    expect(p.left + (844 - p.left - p.right) / 2).toBe(386);
    // Narrower still, the strip shrinks but stays between the column and the card.
    const q = viewPadding({ w: 780, h: 480 });
    const x = q.left + (780 - q.left - q.right) / 2;
    expect(x).toBeGreaterThan(q.left);
    expect(x).toBeLessThan(780 - q.right);
  });

  it("keeps no room for a card that is not open", () => {
    expect(viewPadding({ w: 1200, h: 760, embed: false, timeline: 124, card: false })).toEqual({
      top: 0,
      bottom: 190,
      left: 376,
      right: 0,
    });
  });

  it("gives the column's room back to the map when no panel is open", () => {
    expect(
      viewPadding({
        w: 1440,
        h: 900,
        embed: false,
        timeline: 124,
        card: false,
        chip: false,
        panel: false,
      }),
    ).toEqual({
      top: 0,
      bottom: 190,
      left: 0,
      right: 0,
    });
    // A card open with the column empty: only the card's edge is kept.
    expect(
      viewPadding({
        w: 1440,
        h: 900,
        embed: false,
        timeline: 124,
        card: true,
        chip: false,
        panel: false,
      }),
    ).toEqual({
      top: 0,
      bottom: 190,
      left: 0,
      right: 452,
    });
  });
  it("keeps a short screen's chapter clear of the header and its chip", () => {
    // A phone on its side, no panel, a chapter: header and chip above, the timeline below.
    const p = viewPadding({
      w: 844,
      h: 390,
      embed: false,
      timeline: 124,
      card: false,
      chip: true,
      panel: false,
    });
    expect(p.top).toBeGreaterThan(80);
    expect(p.top + p.bottom).toBeLessThan(390 - 60);
    // A tall screen keeps the whole top: the header sits over a corner of a large map.
    expect(
      viewPadding({
        w: 1440,
        h: 900,
        embed: false,
        timeline: 124,
        card: false,
        chip: true,
        panel: false,
      }).top,
    ).toBe(0);
  });

  it("leaves no room for a column when embedded", () => {
    expect(viewPadding({ w: 1200, h: 800, embed: true }).left).toBe(0);
    expect(viewPadding({ w: 1200, h: 800 }).left).toBeGreaterThan(0);
  });

  it("leaves a phone's map to a chapter when no card is open", () => {
    expect(
      viewPadding({ w: 390, h: 844, embed: false, timeline: 124, card: false, chip: true }),
    ).toEqual({
      top: 120,
      bottom: 148,
      left: 0,
      right: 0,
    });
    // A card open keeps its room, as before.
    expect(
      viewPadding({ w: 390, h: 844, embed: false, timeline: 124, card: true, chip: true }),
    ).toEqual(viewPadding({ w: 390, h: 844 }));
  });

  it("gives an embedded map the frame, clear of the chip and the folded timeline", () => {
    // No card: only the chapter's chip above and the timeline's line below.
    expect(viewPadding({ w: 800, h: 480, embed: true, timeline: 48, card: false })).toEqual({
      top: 56,
      bottom: 72,
      left: 0,
      right: 0,
    });
    // A card open: beside it, and above the timeline as measured.
    expect(viewPadding({ w: 1200, h: 800, embed: true, timeline: 48, card: true })).toEqual({
      top: 56,
      bottom: 72,
      left: 0,
      right: 492,
    });
  });

  it("gives a map-only frame the card's room and the chip's, whatever is selected", () => {
    // A selected place in a large frame: no card on the right, only the link above.
    expect(
      viewPadding({
        w: 1440,
        h: 900,
        embed: true,
        timeline: 40,
        card: true,
        chip: false,
        panel: true,
        mapOnly: true,
      }),
    ).toEqual({
      top: 44,
      bottom: 64,
      left: 0,
      right: 0,
    });
    // The same frame with the card: its edge kept on the right, the chip's height above.
    expect(
      viewPadding({
        w: 1440,
        h: 900,
        embed: true,
        timeline: 40,
        card: true,
        chip: false,
        panel: true,
        mapOnly: false,
      }),
    ).toEqual({
      top: 56,
      bottom: 64,
      left: 0,
      right: 492,
    });
    // A phone-wide frame: the place in the middle of the map, not above a card.
    expect(
      viewPadding({
        w: 390,
        h: 844,
        embed: true,
        timeline: 40,
        card: true,
        chip: false,
        panel: true,
        mapOnly: true,
      }),
    ).toEqual({
      top: 44,
      bottom: 64,
      left: 0,
      right: 0,
    });
    // Outside a frame the flag means nothing: the globe's own card keeps its room.
    expect(
      viewPadding({
        w: 1440,
        h: 900,
        embed: false,
        timeline: 124,
        card: true,
        chip: false,
        panel: true,
        mapOnly: true,
      }),
    ).toEqual(viewPadding({ w: 1440, h: 900 }));
  });
});

describe("a phone picking places for a tool", () => {
  it("frames the map below the tool's panel, and under the header without one", () => {
    const at = { w: 390, h: 844, timeline: 60, card: false };
    expect(viewPadding(at).top).toBe(64);
    // The distance's panel reaching 380 px down: the places land under it.
    expect(viewPadding({ ...at, cover: 380 })).toEqual({
      top: 388,
      bottom: 84,
      left: 0,
      right: 0,
    });
    // A card open keeps its own frame: the column folds under it.
    expect(viewPadding({ ...at, card: true, cover: 380 }).top).toBe(64);
  });
});

describe("sitesFrame", () => {
  const at = [35.0, 31.8] as const;
  it("frames a disputed place with all its candidate sites", () => {
    const sites = [{ at: [34.99, 31.84] as const }, { at: [35.13, 31.83] as const }];
    const frame = sitesFrame(at, sites) ?? [];
    expect(frame.slice(0, 3)).toEqual([at, ...sites.map((x) => x.at)]);
    // A fifth of the width more on either side: 34.99 to 35.13 is 0.14 wide.
    const lons = frame.map((p) => p[0]);
    expect(Math.min(...lons)).toBeCloseTo(34.962);
    expect(Math.max(...lons)).toBeCloseTo(35.158);
  });
  it("leaves a place with one site or none to its own flight", () => {
    expect(sitesFrame(at, undefined)).toBeNull();
    expect(sitesFrame(at, [])).toBeNull();
    expect(sitesFrame(at, [{ at }])).toBeNull();
  });
});
