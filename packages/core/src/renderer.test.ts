import { describe, expect, it } from "vitest";
import { battleInfo } from "./renderer.ts";

describe("battleInfo", () => {
  it("carries the battle's name in every language the data has", () => {
    const info = battleInfo({
      id: "siddim",
      place: "a4a5cce",
      year: -1899,
      approx: true,
      en: "The battle of the kings",
      ru: "Битва царей",
      de: "Die Schlacht der Könige",
      uk: "Битва царів",
    });
    expect(info).toEqual({
      names: {
        en: "The battle of the kings",
        ru: "Битва царей",
        de: "Die Schlacht der Könige",
        uk: "Битва царів",
      },
      year: -1899,
      approx: true,
    });
  });

  it("leaves out properties that are not a language", () => {
    const info = battleInfo({ en: "Gaugamela", year: -330, ref: "1Macc.1.1", place: "x" });
    expect(info?.names).toEqual({ en: "Gaugamela" });
    expect(info?.approx).toBe(false);
  });

  it("gives nothing without an English name or a year", () => {
    expect(battleInfo({ ru: "Битва", year: 1 })).toBeNull();
    expect(battleInfo({ en: "Battle" })).toBeNull();
    expect(battleInfo(undefined)).toBeNull();
  });
});
