import { describe, expect, it } from "vitest";
import { creditLine, creditNamesCommons, licenceUrl } from "./photos.ts";

describe("licenceUrl", () => {
  it("links a CC licence over https", () => {
    expect(
      licenceUrl({ license_url: "http://creativecommons.org/publicdomain/zero/1.0/deed.en" }),
    ).toBe("https://creativecommons.org/publicdomain/zero/1.0/deed.en");
    expect(licenceUrl({ license_url: "https://creativecommons.org/licenses/by/3.0" })).toBe(
      "https://creativecommons.org/licenses/by/3.0",
    );
  });
  it("has nothing to link for a photo in the public domain", () => {
    expect(licenceUrl({})).toBeUndefined();
  });
});

describe("creditLine", () => {
  it("names the credit the author asks for, else the author", () => {
    expect(creditLine({ author: "עוזי פז", credit: "Uzi Paz Pikiwiki Israel" })).toBe(
      "Uzi Paz Pikiwiki Israel",
    );
    expect(creditLine({ author: "Berthold Werner" })).toBe("Berthold Werner");
    expect(creditLine({})).toBeUndefined();
  });
  it("adds the author when the credit does not name them", () => {
    expect(
      creditLine({
        author: "Behzad Alipour",
        credit: "Fars Media Corporation",
        credit_with_author: true,
      }),
    ).toBe("Fars Media Corporation (Behzad Alipour)");
  });
  it("knows a credit that names Wikimedia Commons", () => {
    expect(creditNamesCommons("Mark Landon / Wikimedia Commons")).toBe(true);
    expect(creditNamesCommons("Mark Landon")).toBe(false);
    expect(creditNamesCommons(undefined)).toBe(false);
  });
});
