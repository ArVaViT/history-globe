import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "@hg/model";
import { describe, expect, it } from "vitest";

const web = join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(web, file), "utf8");

// The hand-written pages name the languages themselves: a language added must be added there.
describe("the static pages", () => {
  it("open in English and list every language", () => {
    for (const file of ["index.html", "public/404.html"]) {
      const html = read(file);
      expect(html, file).toContain('<html lang="en">');
      for (const l of LOCALES)
        expect(html, `${file}: ${l}`).toContain(`href="${file === "index.html" ? "" : "/"}${l}/"`);
    }
  });

  it("declare every language to search engines", () => {
    const declared = /"inLanguage": (\[[^\]]*\])/.exec(read("index.html"))?.[1] ?? "[]";
    expect([...(JSON.parse(declared) as string[])].sort()).toEqual([...LOCALES].sort());
  });

  it("send an old About link to every language's documentation", () => {
    const docs = /const docs = (\[[^\]]*\])/.exec(read("public/about.html"))?.[1] ?? "[]";
    expect(JSON.parse(docs)).toEqual(LOCALES.filter((l) => l !== "en"));
  });

  it("let the text-places script read every language", () => {
    const listed = /const LANGS = (\[[^\]]*\])/.exec(read("public/hg-places.js"))?.[1] ?? "[]";
    expect(JSON.parse(listed)).toEqual([...LOCALES].sort());
  });

  it("give the installed app an English name", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as { lang: string };
    expect(manifest.lang).toBe("en");
  });
});
