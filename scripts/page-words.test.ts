import { describe, expect, it } from "vitest";
import { LOCALES } from "../packages/model/src/locales.ts";
import { LANDING } from "./page-words.ts";

/** A whole number of each plural category the language has among 0–1000, by Intl.PluralRules. */
const samples = (l: string): Map<Intl.LDMLPluralRule, number> => {
  const rules = new Intl.PluralRules(l);
  const out = new Map<Intl.LDMLPluralRule, number>();
  for (let n = 0; n <= 1000; n++) if (!out.has(rules.select(n))) out.set(rules.select(n), n);
  return out;
};

describe("the front page's numbers", () => {
  it("are worded for every plural category of every language", () => {
    for (const l of LOCALES)
      for (const [, n] of samples(l)) {
        for (const word of LANDING[l].stats)
          expect(word(n).trim(), `${l} ${String(n)}`).not.toBe("");
        expect(LANDING[l].ctaText(n), `${l} ${String(n)}`).toContain(String(n));
      }
  });

  it("take the form their number asks for", () => {
    // The counts the front page showed in the wrong form (1 231 «мест», 62 «экскурсий»).
    const at = (l: (typeof LOCALES)[number], n: number) => LANDING[l].stats.map((w) => w(n));
    expect(at("ru", 1231)[0]).toBe("место");
    expect(at("ru", 62)[1]).toBe("экскурсии");
    expect(at("ru", 746)[2]).toBe("статей");
    expect(at("uk", 1231)[0]).toBe("місце");
    expect(at("uk", 62)[1]).toBe("екскурсії");
    expect(at("sr", 1231)[0]).toBe("место");
    expect(at("sr", 62)[1]).toBe("туре");
    expect(at("pl", 62)[1]).toBe("trasy");
    expect(at("pl", 1231)[0]).toBe("miejsc");
    expect(at("ro", 1231)[0]).toBe("de locuri");
    expect(at("ro", 15)[0]).toBe("locuri");
    expect(at("en", 1)[0]).toBe("place");
    expect(LANDING.ru.ctaText(21)).toContain("на 21 языке");
    expect(LANDING.ru.ctaText(22)).toContain("на 22 языках");
    expect(LANDING.ro.ctaText(21)).toContain("în 21 de limbi");
  });
});
