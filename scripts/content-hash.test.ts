import { describe, expect, it } from "vitest";
import { pageHash, shortHash, versioned } from "./content-hash.ts";

describe("versioned stylesheets", () => {
  it("name the content in the address", () => {
    expect(versioned("pages.css", "a{}")).toBe(`pages.css?v=${shortHash("a{}")}`);
    expect(versioned("pages.css", "a{}")).not.toBe(versioned("pages.css", "b{}"));
  });

  it("leave a page's hash as it was: a change of style alone sends no page to IndexNow", () => {
    const page = (css: string) =>
      `<link rel="stylesheet" href="../../${versioned("pages.css", css)}" /><p>Bethel</p>`;
    expect(pageHash(page("a{}"))).toBe(pageHash(page("b{}")));
    expect(pageHash(page("a{}"))).toBe(
      shortHash('<link rel="stylesheet" href="../../pages.css" /><p>Bethel</p>'),
    );
    expect(pageHash(page("a{}"))).not.toBe(pageHash(page("a{}").replace("Bethel", "Ai")));
  });
});
