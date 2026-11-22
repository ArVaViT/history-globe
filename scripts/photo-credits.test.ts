import { describe, expect, it } from "vitest";
import { canonicalLicenceUrl, compare, plain, type CommonsMeta } from "./photo-credits.ts";

const meta = (fields: Record<string, string>): CommonsMeta =>
  Object.fromEntries(Object.entries(fields).map(([k, value]) => [k, { value }]));

const byTwoFive = {
  place: "a341fe8",
  file: "PikiWiki Israel 56987 golan and hermon snow.jpg",
  license: "CC BY 2.5",
  license_url: "https://creativecommons.org/licenses/by/2.5/",
};
const pikiwiki = meta({
  LicenseShortName: "CC BY 2.5",
  LicenseUrl: "https://creativecommons.org/licenses/by/2.5",
  Artist: "עוזי פז",
  Attribution: "Uzi Paz Pikiwiki Israel",
});

describe("plain", () => {
  it("drops tags and entities and joins the spaces", () => {
    expect(plain('<a href="x">Heritage Conservation  Outside&nbsp;The City</a>')).toBe(
      "Heritage Conservation Outside The City",
    );
    expect(plain("D&amp;R &#169; &#xA9;")).toBe("D&R © ©");
  });
});

describe("canonicalLicenceUrl", () => {
  it("has one form for each licence link", () => {
    expect(canonicalLicenceUrl("http://creativecommons.org/publicdomain/zero/1.0/deed.en")).toBe(
      "https://creativecommons.org/publicdomain/zero/1.0/",
    );
    expect(canonicalLicenceUrl("https://creativecommons.org/licenses/by/4.0")).toBe(
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });
});

describe("compare", () => {
  it("asks for the credit Commons gives, word for word", () => {
    expect(compare({ ...byTwoFive, author: "עוזי פז" }, pikiwiki)).toEqual([
      expect.stringContaining('the author asks for "Uzi Paz Pikiwiki Israel"'),
    ]);
    expect(
      compare({ ...byTwoFive, author: "עוזי פז", credit: "Uzi Paz Pikiwiki Israel" }, pikiwiki),
    ).toEqual([]);
  });

  it("takes the author as the credit when it is the same words", () => {
    expect(compare({ ...byTwoFive, author: "Uzi Paz Pikiwiki Israel" }, pikiwiki)).toEqual([]);
    expect(
      compare(
        { ...byTwoFive, author: "Uzi Paz Pikiwiki Israel", credit: "Uzi Paz Pikiwiki Israel" },
        pikiwiki,
      ),
    ).toEqual([expect.stringContaining("credit repeats the author")]);
  });

  it("refuses a credit Commons does not ask for", () => {
    const m = meta({ LicenseShortName: "CC BY 2.5", Artist: "Uzi Paz" });
    expect(compare({ ...byTwoFive, author: "Uzi Paz", credit: "Uzi Paz, Israel" }, m)).toEqual([
      expect.stringContaining("Commons asks for none"),
    ]);
  });

  it("finds a licence or version that changed", () => {
    const m = meta({ LicenseShortName: "CC BY-SA 4.0", Attribution: "Uzi Paz Pikiwiki Israel" });
    expect(compare({ ...byTwoFive, author: "Uzi Paz Pikiwiki Israel" }, m)).toEqual([
      expect.stringContaining('Commons says "CC BY-SA 4.0"'),
    ]);
    const v = { ...pikiwiki, LicenseUrl: { value: "https://creativecommons.org/licenses/by/3.0" } };
    expect(compare({ ...byTwoFive, author: "Uzi Paz Pikiwiki Israel" }, v)).toEqual([
      expect.stringContaining("Commons gives https://creativecommons.org/licenses/by/3.0"),
    ]);
  });

  it("names the author Commons names for CC BY, fuller or without Flickr's place", () => {
    const flickr = meta({
      LicenseShortName: "CC BY 2.0",
      Artist:
        '<a href="https://www.flickr.com/people/x">Vladislav Bezrukov</a> from Walldorf, Germany',
    });
    const two = { ...byTwoFive, license: "CC BY 2.0" };
    expect(compare({ ...two, author: "Vladislav Bezrukov" }, flickr)).toEqual([]);
    const alias = meta({ LicenseShortName: "CC BY 2.0", Artist: "yeowatzup" });
    expect(compare({ ...two, author: "Kok Leng Yeo (yeowatzup)" }, alias)).toEqual([]);
    const user = meta({
      LicenseShortName: "CC BY 2.0",
      Artist: "Zachi Evenor and User:MathKnight",
    });
    expect(compare({ ...two, author: "Zachi Evenor and MathKnight" }, user)).toEqual([]);
    const other = meta({ LicenseShortName: "CC BY 2.0", Artist: "Richard Mortel" });
    expect(compare({ ...two, author: "Prof. Mortel" }, other)).toEqual([
      expect.stringContaining('Commons names "Richard Mortel"'),
    ]);
  });

  it("needs no author for the public domain, and reads its licence names alike", () => {
    const pd = meta({ LicenseShortName: "Public domain", Artist: "Unknown author" });
    expect(compare({ place: "a6f33c5", file: "x.jpg", license: "Public domain" }, pd)).toEqual([]);
    const cc0 = meta({
      LicenseShortName: "CC0",
      LicenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    });
    const photo = {
      place: "a51df0e",
      file: "y.jpg",
      license: "CC0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    };
    expect(compare(photo, cc0)).toEqual([]);
  });
});
