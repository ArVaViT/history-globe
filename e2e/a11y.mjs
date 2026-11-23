/**
 * Accessibility: axe-core over the states of the app listed below, from the first frame to
 * an open person, the overview and settings, on a phone in languages with long words, and
 * over the documentation in two languages. The map canvas is left out: it is an image to
 * axe. Then the static pages at 320 px, the narrowest phone: none may scroll sideways.
 *
 * Usage: pnpm e2e:a11y (with the app running; see e2e/browser.mjs)
 */
import { createRequire } from "node:module";
import { BASE, launch, mapReady, newPage, settled } from "./browser.mjs";

const b = await launch();
/** A page per screen size, made on first use. */
const pages = new Map();
const pageOf = async (width = 1440, height = 900) => {
  const key = `${String(width)}x${String(height)}`;
  if (!pages.has(key)) pages.set(key, await newPage(b, { width, height }));
  return pages.get(key);
};
let p = await pageOf();
const axe = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const acts = {
  verse: async () => {
    await p.getByRole("tab", { name: /^Стихи/ }).click();
    await p.locator("button[data-verse]").first().click();
    await p.locator("#verse-text blockquote").waitFor({ timeout: 8000 });
    await settled(p);
  },
  overview: async () => {
    await p.getByRole("button", { name: /^Обзор/ }).click();
    await p.locator("#more-panels").waitFor({ timeout: 8000 });
    await settled(p);
  },
  tools: async () => {
    await p.getByRole("button", { name: "Инструменты" }).click();
    await p.getByRole("button", { name: /^Расстояние/ }).waitFor({ timeout: 8000 });
    await settled(p);
  },
  measure: async () => {
    await p.getByRole("button", { name: "Расстояние отсюда" }).click();
    await p.getByText("Теперь второе").waitFor({ timeout: 8000 });
  },
  more: async () => {
    await p.getByRole("button", { name: /^Ещё/ }).click();
    // The panel loads on the press, then fades in: checked once it is all there.
    await p.getByText("Скорость").first().waitFor({ timeout: 8000 });
    await settled(p);
  },
  search: async () => {
    await p.getByRole("button", { name: /Поиск/ }).click();
    await p.locator("input[role=combobox]").fill("Давид");
    await p.getByRole("option").first().waitFor({ timeout: 8000 });
    await settled(p);
  },
  person: async () => {
    await p.getByRole("button", { name: /Поиск/ }).click();
    await p.locator("input[role=combobox]").fill("Давид");
    await p.locator('[id^="search-person-"]').first().dispatchEvent("mousedown");
    await p
      .getByRole("heading", { name: /^Давид/ })
      .first()
      .waitFor({ timeout: 8000 });
    await settled(p);
  },
  people: async () => {
    if ((await p.getByRole("tab", { name: "Люди" }).count()) === 0)
      await p.getByRole("button", { name: /^Обзор/ }).click();
    await p.getByRole("tab", { name: "Люди" }).click();
    await p.getByRole("tabpanel").first().waitFor({ timeout: 8000 });
    await settled(p);
  },
  settings: async () => {
    await p.getByRole("button", { name: "Настройки" }).click();
    await p.getByRole("dialog").waitFor({ timeout: 8000 });
    await settled(p);
  },
  // The overview in any language: its book is the second button of the header.
  book: async () => {
    await p.locator("aside button[aria-expanded]").first().waitFor();
    await p.evaluate(() => {
      const book = [...document.querySelectorAll("aside button")].find(
        (x) => x.getAttribute("aria-expanded") !== null,
      );
      // Opened before, it is remembered open.
      if (book?.getAttribute("aria-expanded") === "false") book.click();
    });
    await p.locator("#more-panels").waitFor({ timeout: 8000 });
    await settled(p);
  },
};
/** A phone, upright: 375 px, and 320 px, the narrowest. */
const PHONE = [375, 812];
const NARROW = [320, 640];
for (const [url, act, size] of [
  ["?locale=ru"],
  ["?locale=ru&place=af2161c&year=30", "verse"],
  ["?locale=ru&tour=paul-1&stop=3"],
  ["?locale=ru&ref=Acts.16"],
  ["?locale=ru", "settings"],
  ["?locale=en&place=abfba2a"],
  ["?locale=ru", "overview"],
  ["?locale=ru", "more"],
  ["?locale=ru", "tools"],
  ["?locale=ru&place=a15257a&year=30", "measure"],
  ["?locale=ru", "search"],
  ["?locale=ru", "person"],
  ["?locale=ru", "people"],
  ["?locale=ru&year=-1300&camera=36.5,35.5,6,20,0"],
  // The documentation and the honeypot: static pages, no map to wait for.
  ["docs/"],
  ["docs/ru/"],
  ["docs/ru/api.html"],
  ["docs/ru/embedding.html"],
  ["docs/ru/build.html"],
  ["export/"],
  // On a phone a card folds the player to its year and age; Finnish and Vietnamese have the
  // longest ages. The overview's tabs in Tagalog are wider than a 320 px phone.
  ["?locale=fi&year=30&place=a15257a", null, PHONE],
  ["?locale=vi&year=30&place=a15257a", null, PHONE],
  ["?locale=tl", "book", NARROW],
  ["?locale=de&tour=paul-2&stop=4", null, NARROW],
  ["docs/", null, NARROW],
]) {
  p = await pageOf(...(size ?? []));
  await p.goto(BASE + url);
  if (!/^(docs|export)\//.test(url)) {
    await mapReady(p);
    await settled(p);
  }
  if (act) await acts[act]();
  await p.addScriptTag({ path: axe });
  const res = await p.evaluate(async () => {
    const r = await window.axe.run(document, { exclude: [[".maplibregl-canvas-container"]] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      n: v.nodes.length,
      sample: v.nodes
        .slice(0, 2)
        .map(
          (x) =>
            x.target.join(" ") + " :: " + (x.failureSummary ?? "").split("\n").slice(1, 2).join(""),
        ),
    }));
  });
  console.log("==", url, act ?? "", res.length ? "" : "0 violations");
  if (res.length) process.exitCode = 1;
  for (const v of res)
    console.log(`  [${v.impact}] ${v.id} x${v.n}: ${v.help}\n     ${v.sample.join("\n     ")}`);
}

// At 320 px no static page scrolls sideways: a line that cannot wrap (a tour's title, the
// documentation's bar) pushed the page past the screen.
p = await pageOf(...NARROW);
for (const url of [
  "docs/",
  "docs/fi/",
  "docs/tl/api.html",
  ...["en", "de", "es", "fi", "ru", "tl", "vi"].flatMap((l) => [
    `${l}/`,
    `${l}/tours/`,
    `${l}/places/`,
    `${l}/tour/paul-2/`,
  ]),
]) {
  await p.goto(BASE + url);
  const wide = await p.evaluate(() => document.documentElement.scrollWidth);
  if (wide > 320) {
    console.log(`== ${url} scrolls sideways at 320 px: ${String(wide)} px wide`);
    process.exitCode = 1;
  }
}
console.log("== the static pages at 320 px: checked");

// The landing's own buttons take a press at their middle: the glow behind its picture once
// rose over them, and a tap there did nothing (axe does not see it).
for (const size of [NARROW, [1440, 900]]) {
  p = await pageOf(...size);
  await p.goto(BASE + "en/");
  await settled(p);
  const covered = await p.evaluate(() =>
    [...document.querySelectorAll("section.hero .actions-row a")].flatMap((a) => {
      const r = a.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top && (top === a || a.contains(top)) ? [] : [a.textContent.trim()];
    }),
  );
  if (covered.length > 0) {
    console.log(`== the landing at ${String(size[0])} px covers ${covered.join(", ")}`);
    process.exitCode = 1;
  }
}
console.log("== the landing's buttons take a press: checked");
await b.close();
