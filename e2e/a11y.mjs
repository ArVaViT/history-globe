/**
 * Accessibility: axe-core (loaded from cdnjs into the page, not installed) over twelve
 * states of the app, from the first frame to an open person, the overview and settings.
 * The map canvas is left out: it is an image to axe.
 *
 * Usage: pnpm e2e:a11y (with the app running; see e2e/browser.mjs)
 */
import { BASE, launch } from "./browser.mjs";

const b = await launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const acts = {
  verse: async () => {
    await p.getByRole("tab", { name: /^Стихи/ }).click();
    await p.locator("button[data-verse]").first().click();
    await p.waitForTimeout(600);
  },
  overview: async () => {
    await p.getByRole("button", { name: /^Обзор/ }).click();
    await p.waitForTimeout(1200);
  },
  more: async () => {
    await p.getByRole("button", { name: /^Ещё/ }).click();
    // The panel loads on the press, then fades in: checked once it is all there.
    await p.getByText("Скорость").first().waitFor({ timeout: 8000 });
    await p.waitForTimeout(600);
  },
  walls: async () => {
    await p.getByRole("button", { name: /^Ещё/ }).click();
    await p.getByRole("button", { name: /Стены Иерусалима/ }).click();
    await p.getByText(/га, по стенам/).waitFor({ timeout: 8000 });
    await p.waitForTimeout(400);
  },
  search: async () => {
    await p.getByRole("button", { name: /Поиск/ }).click();
    await p.locator("input[role=combobox]").fill("Давид");
    await p.waitForTimeout(900);
  },
  person: async () => {
    await p.getByRole("button", { name: /Поиск/ }).click();
    await p.locator("input[role=combobox]").fill("Давид");
    await p.waitForTimeout(900);
    await p.locator('[id^="search-person-"]').first().dispatchEvent("mousedown");
    await p.waitForTimeout(2500);
  },
  people: async () => {
    if ((await p.getByRole("tab", { name: "Люди" }).count()) === 0)
      await p.getByRole("button", { name: /^Обзор/ }).click();
    await p.waitForTimeout(800);
    await p.getByRole("tab", { name: "Люди" }).click();
    await p.waitForTimeout(1200);
  },
  settings: async () => {
    await p.getByRole("button", { name: "Настройки" }).click();
    await p.waitForTimeout(400);
  },
};
for (const [url, act] of [
  ["?locale=ru"],
  ["?locale=ru&place=af2161c&year=30", "verse"],
  ["?locale=ru&tour=paul-1&stop=3"],
  ["?locale=ru&ref=Acts.16"],
  ["?locale=ru", "settings"],
  ["?locale=en&place=abfba2a"],
  ["?locale=ru", "overview"],
  ["?locale=ru", "more"],
  ["?locale=ru&year=30&camera=35.231,31.777,13.5,0,0", "walls"],
  ["?locale=ru", "search"],
  ["?locale=ru", "person"],
  ["?locale=ru", "people"],
  ["?locale=ru&year=-1300&camera=36.5,35.5,6,20,0"],
]) {
  await p.goto(BASE + url);
  await p.waitForFunction(() => window.__hgMap?.loaded(), null, { timeout: 45000 });
  await p.waitForTimeout(1500);
  if (act) await acts[act]();
  await p.addScriptTag({
    url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
  });
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
await b.close();
