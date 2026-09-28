import { describe, expect, it } from "vitest";
import { formatRef, NT_BOOKS } from "./scripture.ts";

describe("formatRef", () => {
  it.each([
    ["Acts.13.4", "ru", "Деян 13:4"],
    ["Acts.13.4", "en", "Acts 13:4"],
    ["1Kgs.6.1", "ru", "3 Цар 6:1"],
    ["2Sam.5.6-2Sam.5.9", "ru", "2 Цар 5:6–9"],
    ["Acts.13.4-Acts.14.26", "ru", "Деян 13:4–14:26"],
    ["Luke.7", "ru", "Лк 7"],
  ] as const)("%s (%s) → %s", (osis, locale, text) => {
    expect(formatRef(osis, locale)).toBe(text);
  });

  it("rejects unknown books and cross-book ranges", () => {
    expect(() => formatRef("Enoch.1.1", "ru")).toThrow(SyntaxError);
    expect(() => formatRef("Matt.1.1-Mark.1.1", "ru")).toThrow(SyntaxError);
  });

  it("knows all 27 New Testament books", () => {
    expect(NT_BOOKS.size).toBe(27);
  });
});
