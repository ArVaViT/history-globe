import { describe, expect, it } from "vitest";
import { BOOKS, DEUTEROCANON } from "../packages/model/src/scripture.ts";
import { STEP_TO_OSIS, USFM_TO_OSIS } from "./bible-books.ts";

/** The canon the app knows (packages/model/src/scripture.ts), less 1-2 Maccabees. */
const canon = Object.keys(BOOKS).filter((b) => !DEUTEROCANON.has(b));

describe("the Bible's books", () => {
  it("are the app's books, in the canon's order", () => {
    expect(Object.values(USFM_TO_OSIS)).toEqual(canon);
  });

  it("map every STEPBible abbreviation to one of them, and miss none", () => {
    expect([...new Set(Object.values(STEP_TO_OSIS))].sort()).toEqual([...canon].sort());
  });
});
