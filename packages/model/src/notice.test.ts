import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOTICE, NOTICE_COMMENT } from "./notice.ts";
import { REPOSITORY, SITE_ORIGIN } from "./site.ts";
import { LOCALES } from "./locales.ts";

const root = join(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(join(root, file), "utf8");
const AGPL = "https://www.gnu.org/licenses/agpl-3.0.html";

// The notice repeats what LICENSE grants; the two must not say different things.
describe("the notice", () => {
  it("gives each part the licence LICENSE gives it", () => {
    const licence = read("LICENSE");
    for (const [part, spdx] of [
      ["The data is CC BY 4.0", "CC BY 4.0"],
      ["are CC BY-NC-ND 4.0", "CC BY-NC-ND 4.0"],
      ["The code is AGPL-3.0-or-later", "AGPL-3.0-or-later"],
    ] as const) {
      expect(NOTICE).toContain(part);
      expect(licence).toContain(spdx);
    }
    expect(licence).toContain("or (at your option) any later version");
    expect(NOTICE).toContain('"History Globe by Vadym Arnaut"');
    expect(licence).toContain('"History Globe by Vadym Arnaut"');
    expect(read("COPYING")).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
  });

  it("offers the source and points to the details", () => {
    expect(NOTICE).toContain(REPOSITORY);
    expect(NOTICE).toContain(`${SITE_ORIGIN}/docs/build.html`);
    expect(NOTICE).toContain(`${SITE_ORIGIN}/llms.txt`);
  });

  it("can stand in an HTML comment", () => {
    expect(NOTICE).not.toContain("--");
    expect(NOTICE_COMMENT).toBe(`<!-- ${NOTICE} -->`);
  });

  // The code was once "all rights reserved"; no public text may still say so of it.
  // The code is version 3 or any later version (ADR 0019); no text may narrow it to 3 alone.
  it.each([
    "LICENSE",
    "README.md",
    "CONTRIBUTING.md",
    "CITATION.cff",
    "package.json",
    "apps/web/package.json",
    "packages/core/package.json",
    "packages/model/package.json",
    "apps/web/index.html",
    "apps/web/public/404.html",
    "apps/web/public/export/index.html",
    "scripts/build-pages.ts",
  ])("does not narrow the code to AGPL-3.0-only in %s", (file) => {
    expect(read(file)).not.toMatch(/AGPL-3\.0-only|version 3 only/i);
  });

  it.each([
    "README.md",
    "CITATION.cff",
    "apps/web/vite.config.ts",
    "scripts/build-pages.ts",
    "content/docs/en/build.html",
  ])("is not contradicted by %s", (file) => {
    expect(read(file)).not.toMatch(/all rights reserved|do not clone|source-available/i);
  });

  it.each(LOCALES)("is the licence the Build and Author pages give the code in %s", (l) => {
    for (const page of ["build", "author"]) {
      const html = read(`content/docs/${l}/${page}.html`);
      expect(html, page).toContain(`<a href="${AGPL}">AGPL-3.0</a>`);
      // The link is followed by the page's own words for "or any later version".
      expect(html, page).not.toMatch(/AGPL-3\.0<\/a>(<\/td>|\s*:)/);
      expect(html, page).toContain(`href="${REPOSITORY}"`);
    }
  });
});
