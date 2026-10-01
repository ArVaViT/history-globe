import { describe, expect, it } from "vitest";
import en from "./en.json";
import { translate } from "./index";
import ru from "./ru.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** Plural forms differ by language (ru: one/few/many, en: one/other): compare base keys. */
function baseKeys(obj: object): string[] {
  return [
    ...new Set(keys(obj).map((k) => k.replace(/_(zero|one|two|few|many|other)$/, ""))),
  ].sort();
}

describe("i18n dictionaries", () => {
  it("ru and en define the same keys", () => {
    expect(baseKeys(ru)).toEqual(baseKeys(en));
  });

  it("keys the UI relies on exist where it looks for them", () => {
    for (const key of [
      "place.zoom",
      "place.synodal_from",
      "place.close",
      "tours.close",
      "loading",
    ]) {
      expect(keys(ru)).toContain(key);
    }
  });

  it("chooses the plural form by language and fills the placeholders", () => {
    expect(translate("ru", "tours.stops", { count: 1 })).toBe("1 остановка");
    expect(translate("ru", "tours.stops", { count: 3 })).toBe("3 остановки");
    expect(translate("ru", "tours.stops", { count: 12 })).toBe("12 остановок");
    expect(translate("ru", "tours.stops", { count: 21 })).toBe("21 остановка");
    expect(translate("en", "tours.stops", { count: 1 })).toMatch(/^1 stop$/);
    expect(translate("en", "tours.stops", { count: 5 })).toMatch(/^5 stops$/);
    expect(translate("ru", "tours.stop", { n: 2, total: 9 })).toBe("Остановка 2 из 9");
  });

  it("falls back to English, then to the key", () => {
    expect(translate("de", "place.zoom")).toBe(translate("en", "place.zoom"));
    expect(translate("ru", "kind.no such kind")).toBe("kind.no such kind");
  });
});
