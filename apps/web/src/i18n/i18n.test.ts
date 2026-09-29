import { describe, expect, it } from "vitest";
import en from "./en.json";
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
});
