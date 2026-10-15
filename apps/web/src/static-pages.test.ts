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

  // index.html draws the title bar before any script; App.tsx draws its own over it.
  it("draw a first screen that matches the app's title bar and has no words but the name", () => {
    const html = read("index.html");
    const shell = /<div id="hg-shell"[\s\S]*?\n {4}<\/div>\n/.exec(html)?.[0] ?? "";
    expect(shell).not.toBe("");
    const text = shell
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .trim();
    expect(text).toBe("History Globe");
    const app = read("src/App.tsx");
    expect(app).toMatch(/>\s*History Globe\s*<\/h1>/);
    const classes = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
    const shellClasses = classes(
      [...shell.matchAll(/class="([^"]+)"/g)].map((m) => m[1] ?? "").join(" "),
    );
    const panel = /className={`(rounded-\[20px\][^`$]+)/.exec(
      read("src/components/Panel.tsx"),
    )?.[1];
    const bar = /<Panel className="(relative z-10 flex w-\[360px\][^"]+)">/.exec(app)?.[1];
    const title = /<h1\s+className={`(order-2 [^`$]+)/.exec(app)?.[1];
    expect(panel && bar && title).toBeTruthy();
    for (const c of classes(`${panel ?? ""} ${bar ?? ""} ${title ?? ""}`))
      if (c !== "order-2") expect(shellClasses, c).toContain(c);
    for (const c of [
      "absolute",
      "top-4",
      "left-4",
      "-m-4",
      "p-4",
      "pr-5",
      "max-md:inset-x-3",
      "max-md:top-3",
      "max-md:pr-4",
    ])
      expect(shellClasses, c).toContain(c);
  });
});
