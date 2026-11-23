import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// REUSE.toml states the licence of every file for tools; LICENSE states it in words. These
// checks keep the two, the licence texts in LICENSES/ and the reviews in step. The full
// check of the format is `uvx reuse lint`, which needs a tool outside the gate.
const root = join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");
const toml = read("REUSE.toml");

interface Annotation {
  paths: string[];
  licence: string;
  copyright: string;
}

/** The [[annotations]] tables, read as far as these checks need them. */
const annotations: Annotation[] = toml
  .split("[[annotations]]")
  .slice(1)
  .map((table) => {
    const value = (key: string) =>
      new RegExp(`^${key} = (\\[[^\\]]*\\]|"[^"]*")`, "m").exec(table)?.[1] ?? "";
    const strings = (raw: string) => [...raw.matchAll(/"([^"]*)"/g)].map((m) => m[1] ?? "");
    return {
      paths: strings(value("path")),
      licence: strings(value("SPDX-License-Identifier"))[0] ?? "",
      copyright: strings(value("SPDX-FileCopyrightText")).join("; "),
    };
  });

/** The annotation that applies to a path named exactly: the last that names it. */
const exact = (path: string) => annotations.filter((a) => a.paths.includes(path)).at(-1);

const ids = (expression: string) =>
  expression.split(/\s+(?:AND|OR|WITH)\s+|[()]/).filter((id) => id.trim() !== "");

describe("REUSE.toml", () => {
  it("has the text of every licence it names in LICENSES/, and no other", () => {
    const used = new Set(annotations.flatMap((a) => ids(a.licence)));
    const texts = readdirSync(join(root, "LICENSES")).map((f) => f.replace(/\.txt$/, ""));
    expect([...used].sort()).toEqual(texts.sort());
  });

  it("gives the code the AGPL text that COPYING holds", () => {
    // COPYING stays the GNU text byte for byte, so tools recognise it; the section 7
    // terms are in LICENSE, part 1.
    expect(read("COPYING")).toBe(read("LICENSES/AGPL-3.0-or-later.txt"));
    expect(annotations[0]).toMatchObject({ paths: ["**"], licence: "AGPL-3.0-or-later" });
  });

  it("gives each part the licence LICENSE gives it", () => {
    const licence = read("LICENSE");
    for (const [path, spdx, words] of [
      ["apps/web/public/hg-places.js", "MIT", "MIT licence"],
      ["content/articles/**", "CC-BY-NC-ND-4.0", "CC BY-NC-ND 4.0"],
      ["content/drafts/**", "CC0-1.0", "CC0"],
      ["pipeline/dataset_card.md", "CC-BY-4.0", "pipeline/dataset_card.md"],
      ["apps/web/public/shots/**", "LicenseRef-PreviewImages", "shots/"],
      ["apps/web/public/og/tour/**", "CC-BY-4.0", "og/tour/*.jpg"],
      ["apps/web/public/shots/*-place.jpg", "LicenseRef-PreviewImages AND CC-BY-2.0", "CC BY 2.0"],
      ["apps/web/public/shots/*-tour.jpg", "LicenseRef-PreviewImages AND CC-BY-4.0", "Raicem"],
      ["docs/crosswalk/*.csv", "CC-BY-4.0 AND CC-BY-SA-4.0", "CC BY-SA 4.0 applies"],
      ["content/README.md", "AGPL-3.0-or-later", "documentation of the project"],
      ["CODE_OF_CONDUCT.md", "CC-BY-4.0", "Contributor Covenant"],
    ] as const) {
      expect(exact(path)?.licence, path).toBe(spdx);
      expect(licence, path).toContain(words);
    }
  });

  // The notices file is written from the build; its annotation names every licence it lists.
  it("names every licence the third-party notices list", () => {
    const listed = new Set(
      [...read("apps/web/public/licenses/third-party.txt").matchAll(/^ {2}\S+ \S+ \(([^)]+)\)$/gm)]
        .map((m) => m[1] ?? "")
        .flatMap(ids),
    );
    const annotated = ids(exact("apps/web/public/licenses/third-party.txt")?.licence ?? "");
    expect([...new Set(annotated)].sort()).toEqual([...listed].sort());
  });

  // A review is its author's; the licence is the one the reviewer gave (LICENSE, part 4).
  it.each(readdirSync(join(root, "content/reviews")).filter((f) => f.endsWith(".yaml")))(
    "states the reviewer's licence of %s",
    (file) => {
      const review = read(`content/reviews/${file}`);
      const given = /^licence: (\S+)$/m.exec(review)?.[1];
      const name = /^ {2}name: "([^"]+)"$/m.exec(review)?.[1];
      const annotation = exact(`content/reviews/${file}`);
      expect(annotation?.licence).toBe(given);
      expect(annotation?.copyright).toContain(name);
    },
  );

  it("names only paths that exist", () => {
    for (const path of annotations.flatMap((a) => a.paths).filter((p) => !/[*]/.test(p)))
      expect(existsSync(join(root, path)), path).toBe(true);
  });
});
