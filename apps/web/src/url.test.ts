import { describe, expect, it } from "vitest";
import { readUrl } from "./url";

describe("readUrl", () => {
  it("reads a full view", () => {
    expect(readUrl("?year=-585&place=a15257a&camera=35.2,31.7,9,45,-10&locale=en")).toEqual({
      year: -585,
      place: "a15257a",
      camera: { center: [35.2, 31.7], zoom: 9, pitch: 45, bearing: -10 },
      locale: "en",
    });
  });

  it("ignores malformed or unsafe values instead of failing", () => {
    expect(readUrl("?year=abc&place=<script>&camera=1,2,3&locale=xx")).toEqual({});
  });

  it("keeps year zero (1 BC) — it is a real astronomical year", () => {
    expect(readUrl("?year=0").year).toBe(0);
  });
});
