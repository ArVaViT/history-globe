import { describe, expect, it } from "vitest";
import { localeData, loadLocaleData } from "./locale-data.ts";
import { ALL_LOCALES, LOCALES } from "./time.ts";

describe("locale data", () => {
  it("has a file for every language beyond English and Russian", () => {
    for (const l of ALL_LOCALES) {
      if (l === "en" || l === "ru") expect(localeData(l)).toBeUndefined();
      else expect(localeData(l)?.periods, l).toBeDefined();
    }
  });

  it("gives every published language its books, eras and site words", () => {
    for (const l of LOCALES) {
      if (l === "en" || l === "ru") continue;
      const d = localeData(l);
      expect(Object.keys(d?.books ?? {}).length, l).toBeGreaterThan(60);
      expect(Object.keys(d?.bookNames ?? {}).length, l).toBeGreaterThan(60);
      expect(d?.site?.km, l).toBeTruthy();
    }
  });

  it("loads nothing for a language the code does not know", async () => {
    expect(await loadLocaleData("xx")).toBe(false);
    expect(await loadLocaleData("../time")).toBe(false);
    expect(await loadLocaleData("en")).toBe(true);
  });
});
