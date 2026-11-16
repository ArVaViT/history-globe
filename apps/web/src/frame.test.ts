import { describe, expect, it } from "vitest";
import { frameParts } from "./frame";

describe("what a frame shows", () => {
  it("the globe's own page: whole, whatever a link says", () => {
    expect(frameParts(false, false, true)).toEqual({ compact: false, card: true, chapter: true });
    expect(frameParts(false, true, false)).toEqual({ compact: false, card: true, chapter: true });
  });

  it("an embed: compact only when small, with its card and chapter bar", () => {
    expect(frameParts(true, false, true)).toEqual({ compact: false, card: true, chapter: true });
    expect(frameParts(true, false, false)).toEqual({ compact: true, card: true, chapter: true });
  });

  it("map-only: compact at any size, no card, no chapter bar", () => {
    for (const big of [true, false])
      expect(frameParts(true, true, big)).toEqual({ compact: true, card: false, chapter: false });
  });
});
