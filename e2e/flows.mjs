/**
 * The app's main ways through, in a real browser: search, a place card and its verses,
 * keys, layers, tours, events, the overview, people, languages, bad links. Each step
 * prints ok or FAIL; page errors fail the run.
 *
 * Usage: pnpm e2e (with the app running; see e2e/browser.mjs)
 */
import { BASE, launch, mapReady, newPage, settled } from "./browser.mjs";

const browser = await launch();
const results = [];
const errors = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(
      `FAIL ${name}: ${String(e.message).split("\n").slice(0, 6).join(" | ").slice(0, 600)}`,
    );
  }
}
const page = await newPage(browser);
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404"))
    errors.push(`console: ${m.text().slice(0, 160)}`);
});
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
/**
 * What a step expects, once the app has done it (it writes the address after a pause, a
 * panel loads its code on the press): checked again until it holds, or fails with `msg`.
 */
async function until(check, msg, timeout = 8000) {
  const end = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > end) throw new Error(msg);
    await new Promise((r) => setTimeout(r, 50));
  }
}
const search = () => new URLSearchParams(new URL(page.url()).search);
/** The search's word for no results (search.empty in apps/web/src/i18n/ru.json). */
const EMPTY_SEARCH = "Ничего не найдено";
// Starting a tour puts the overview away: open it again where a step needs its tabs.
const overview = async () => {
  const book = page.getByRole("button", { name: /^Обзор/ });
  if ((await book.getAttribute("aria-expanded")) !== "true") await book.click();
  await page.locator("#more-panels").waitFor({ timeout: 8000 });
};

await page.goto(BASE + "?locale=ru");
await mapReady(page);
await settled(page);

await step("search finds Capernaum and opens its card", async () => {
  // The search is a magnifier in the header until pressed.
  await page.getByRole("button", { name: "Поиск места" }).click();
  await page.getByPlaceholder("Место, человек, глава или год").fill("Капер");
  await page.getByRole("option").first().click();
  await page.getByRole("heading", { name: "Капернаум" }).waitFor({ timeout: 5000 });
});
await step("a verse opens its Synodal text, with BibleGateway RUSV beside it", async () => {
  await page.getByRole("tab", { name: /^Стихи/ }).click();
  await page.locator("button[data-verse]").first().click();
  const text = await page.locator("#verse-text blockquote").innerText({ timeout: 5000 });
  expect(/[а-я]/.test(text), `text ${text}`);
  const href = await page.locator('#verse-text a[href*="biblegateway"]').getAttribute("href");
  expect(href && href.includes("version=RUSV"), `href ${href}`);
  await page.locator("button[data-verse]").first().click();
  expect((await page.locator("#verse-text").count()) === 0, "verse text did not close");
});
await step("Google Maps link has lat,lon", async () => {
  const href = await page.locator('a[href*="google.com/maps"]').getAttribute("href");
  expect(/query=32\.8\d*,35\.5/.test(href ?? ""), `href ${href}`);
});
await step("URL holds the place", async () => {
  await until(() => search().get("place") === "af2161c", `place=${search().get("place")}`);
});
await step('"ещё N" opens more verses', async () => {
  const before = await page.locator("button[data-verse]").count();
  const more = page.locator("[role=tabpanel]").getByRole("button", { name: /^ещё \d+/ });
  // Capernaum's 16 verses all fit in the first 24: nothing more to open.
  if ((await more.count()) === 0) {
    expect(before > 0 && before <= 24, `${before} shown`);
    return;
  }
  await more.click();
  const after = await page.locator("button[data-verse]").count();
  expect(after > before, `${before} -> ${after}`);
});
await step("Escape closes the card", async () => {
  await page
    .locator("body")
    .click({ position: { x: 900, y: 500 } })
    .catch(() => {});
  await page.keyboard.press("Escape");
  await until(
    async () => (await page.getByRole("heading", { name: "Капернаум" }).count()) === 0,
    "card still open",
  );
});
await step("] moves the year +10, Shift+] +100", async () => {
  await page
    .locator("canvas")
    .first()
    .click({ position: { x: 1200, y: 300 } });
  const y0 = Number(search().get("year"));
  await page.keyboard.press("]");
  await until(() => Number(search().get("year")) === y0 + 10, "] did not step on");
  await page.keyboard.press("Shift+BracketLeft");
  await until(
    () => Number(search().get("year")) === y0 + 10 - 100,
    `${y0} -> ${search().get("year")}`,
  );
});
await step("space plays and pauses, / focuses the search", async () => {
  await page
    .locator("canvas")
    .first()
    .click({ position: { x: 1200, y: 300 } });
  const y0 = Number(search().get("year"));
  await page.keyboard.press(" ");
  // Played for a while: a span of time, not a state to wait for.
  await page.waitForTimeout(900);
  await page.keyboard.press(" ");
  await until(() => Number(search().get("year")) > y0, `${y0} -> ${search().get("year")}`);
  await page.keyboard.press("/");
  await until(
    () =>
      page
        .getByPlaceholder("Место, человек, глава или год")
        .evaluate((el) => el === document.activeElement),
    "search not focused",
  );
  await page.keyboard.press("Escape");
});
await step("the book opens the overview on its tours", async () => {
  await page.getByRole("button", { name: "Обзор: экскурсии, события, люди, статьи" }).click();
  await page.getByRole("tab", { name: "Экскурсии" }).click();
  await page.getByText("Земная жизнь Иисуса").waitFor({ timeout: 3000 });
});
await step("layers off are written to the URL", async () => {
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByText("Рельеф").click();
  await until(() => search().get("hide") === "relief", `hide=${search().get("hide")}`);
  await page.getByText("Рельеф").click();
  await until(() => !search().has("hide"), `hide=${search().get("hide")}`);
  await page.keyboard.press("Escape");
  expect(!search().has("layers"), "layers still in URL");
});
await step("map key opens", async () => {
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("button", { name: "Условные знаки" }).click();
  await page.getByText("стоянка Исхода").waitFor({ timeout: 2000 });
  // Esc on the key goes back to the settings, a second Esc closes them.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Условные знаки" }).waitFor({ timeout: 2000 });
  await page.keyboard.press("Escape");
  await until(
    async () => (await page.locator("dialog[open]").count()) === 0,
    "a dialog stayed open",
  );
});
await step("tour: start, next, back, close", async () => {
  await page.getByRole("tab", { name: "Экскурсии" }).click();
  await page.getByText("Земная жизнь Иисуса").click({ timeout: 5000 });
  await page.getByText("Остановка 1 из 17").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Дальше" }).click({ timeout: 5000 });
  await page.getByText("Остановка 2 из 17").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Назад", exact: true }).click({ timeout: 5000 });
  await page.getByText("Остановка 1 из 17").first().waitFor({ timeout: 3000 });
  await until(() => search().get("tour") === "jesus", `tour=${search().get("tour")}`);
  await page.getByRole("button", { name: "Закончить" }).click();
  await until(() => !search().has("tour"), "tour still in URL");
  expect(!search().has("place"), "a stop's card stayed open");
});
await step("events panel: a pick sets the year and opens the place", async () => {
  // Events are a tab of the overview panel.
  await overview();
  await page.getByRole("tab", { name: "События" }).click();
  await page.getByRole("button", { name: /Ассирия берёт Самарию/ }).click();
  await page.getByRole("heading", { name: "Самария" }).waitFor({ timeout: 5000 });
  await until(() => search().get("year") === "-721", `year=${search().get("year")}`);
  await page.keyboard.press("Escape");
});
await step("tour: step dot jumps, arrows step, About the place ends the tour", async () => {
  await page.getByRole("tab", { name: "Экскурсии" }).click();
  await page.getByText("Путь Авраама").click({ timeout: 5000 });
  await page.getByRole("button", { name: /^3\. / }).click();
  await page.getByText("Остановка 3 из 12").first().waitFor({ timeout: 3000 });
  await page.keyboard.press("ArrowRight");
  await page.getByText("Остановка 4 из 12").first().waitFor({ timeout: 3000 });
  await page.keyboard.press("ArrowLeft");
  await page.getByText("Остановка 3 из 12").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "О месте" }).click();
  await page.getByRole("heading", { name: "Сихем" }).waitFor({ timeout: 5000 });
  await until(() => !search().has("tour"), "tour still in URL");
  // ...and the place card leads back to the same stop.
  await page.getByRole("button", { name: /Вернуться к экскурсии/ }).click();
  await page.getByText("Остановка 3 из 12").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Закончить" }).click();
  await page.keyboard.press("Escape");
});
await step("search during a tour ends it and opens the place", async () => {
  await overview();
  await page.getByRole("tab", { name: "Экскурсии" }).click();
  await page.locator("#overview-panel").getByText("Путь Авраама").click({ timeout: 5000 });
  await page.getByText("Остановка 1 из 12").first().waitFor({ timeout: 3000 });
  if (await page.getByRole("button", { name: "Поиск места" }).count())
    await page.getByRole("button", { name: "Поиск места" }).click();
  await page.getByPlaceholder("Место, человек, глава или год").fill("Капер");
  await page.getByRole("option").first().click();
  await page.getByRole("heading", { name: "Капернаум" }).waitFor({ timeout: 5000 });
  await until(() => !search().has("tour"), "tour still in URL");
  await page.keyboard.press("Escape");
});
await step("book opens and closes the overview", async () => {
  const book = page.getByRole("button", { name: /^Обзор/ });
  const open = async () => (await book.getAttribute("aria-expanded")) === "true";
  if (await open()) await book.click();
  await until(
    async () => !(await open()) && (await page.locator("#more-panels").count()) === 0,
    "overview did not close",
  );
  await book.click();
  await page.locator("#more-panels").waitFor({ timeout: 2000 });
  expect(await open(), "not expanded");
});
await step("switch to English", async () => {
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("combobox", { name: "Язык" }).selectOption("en");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /Find a place|Close the search/ })
    .waitFor({ timeout: 3000 });
  await until(() => search().get("locale") === "en", "locale not in URL");
});
await step("slider: keyboard arrow changes the year", async () => {
  const s = page.locator('input[type="range"]');
  await s.focus();
  const before = await s.inputValue();
  await page.keyboard.press("ArrowRight");
  await until(async () => (await s.inputValue()) !== before, "unchanged");
});
await step("Nineveh card at 600 BC says it no longer stands", async () => {
  await page.goto(BASE + "?year=-600&place=a70fd5d&locale=ru");
  await page.getByText("В этом году города уже нет").waitFor({ timeout: 15000 });
});
await step("bad link does not hang", async () => {
  await page.goto(
    BASE + "?camera=500,95,99,120,9&year=abc&place=zz&locale=xx&tour=nope&layers=zzz",
  );
  await page.waitForFunction(() => !document.body.innerText.includes("Загружаем карту"), null, {
    timeout: 20000,
  });
});

await step("a person found by name opens their card and takes the map to their time", async () => {
  await page.goto(BASE + "?locale=ru&year=30");
  await mapReady(page);
  await page.getByRole("button", { name: /^Поиск/ }).click();
  await page.locator("input[role=combobox]").fill("Давид");
  await page.locator('[id^="search-person-"]').first().waitFor({ timeout: 8000 });
  expect(
    (await page.locator('[id^="search-person-"]').first().innerText()).includes("XI в. до н. э."),
    "century in the search",
  );
  await page.locator('[id^="search-person-"]').first().dispatchEvent("mousedown");
  await page.getByRole("heading", { name: "Давид" }).waitFor({ timeout: 8000 });
  await until(() => search().get("year") === "-1002", `year=${search().get("year")}`);
  expect((await page.getByText("Адам").count()) > 0, "line from Adam");
});
await step("Overview → People lists the story's people by century", async () => {
  await page.goto(BASE + "?locale=ru");
  await mapReady(page);
  // The overview remembers being open: press it only if its tabs are not there.
  if ((await page.getByRole("tab", { name: "Люди" }).count()) === 0)
    await page.getByRole("button", { name: /^Обзор/ }).click();
  await page.getByRole("tab", { name: "Люди" }).click();
  await page.getByRole("button", { name: "Илия", exact: true }).click({ timeout: 8000 });
  await page.getByRole("heading", { name: "Илия" }).waitFor({ timeout: 8000 });
});
await step(
  "an ancient site found by name flies there, and its card goes to a year it stood",
  async () => {
    await page.goto(BASE + "?locale=ru&year=30");
    await mapReady(page);
    await page.getByRole("button", { name: /^Поиск/ }).click();
    await page.locator("input[role=combobox]").fill("Хаттуса");
    // An ancient site is a place like any other (ADR 0018): its option bears its Pleiades number.
    await page.locator("#search-283602441").dispatchEvent("mousedown", { timeout: 8000 });
    // Gone by AD 30, it is shown pale; its card offers a year it stood (#60).
    await page.getByRole("heading", { name: "Хаттуса" }).waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: /^Перейти в/ }).click({ timeout: 5000 });
    // Its years in content/ancient-sites.json: -1999 to -1179.
    const year = () => Number(search().get("year"));
    await until(() => year() <= -1179 && year() >= -1999, `year=${year()}`);
    const cam = () => (search().get("camera") ?? "").split(",").map(Number);
    await until(
      () => Math.abs(cam()[0] - 34.6) < 0.5 && Math.abs(cam()[1] - 40.0) < 0.5,
      `camera=${cam()}`,
    );
  },
);

await step("a battle found by a word of its title goes to its year and its field", async () => {
  await page.goto(BASE + "?locale=ru&year=30");
  await mapReady(page);
  await page.getByRole("button", { name: /^Поиск/ }).click();
  await page.locator("input[role=combobox]").fill("Гавгамел");
  await page.locator('[id^="search-event-"]').first().dispatchEvent("mousedown", { timeout: 8000 });
  await until(() => search().get("year") === "-330", `year=${search().get("year")}`);
  const cam = () => (search().get("camera") ?? "").split(",").map(Number);
  await until(
    () => Math.abs(cam()[0] - 43.5) < 0.5 && Math.abs(cam()[1] - 36.6) < 0.5,
    `camera=${cam()}`,
  );
});

await step("a person without places on the map (Noah) is found and opens their card", async () => {
  await page.goto(BASE + "?locale=ru&year=30");
  await mapReady(page);
  await page.getByRole("button", { name: /^Поиск/ }).click();
  await page.locator("input[role=combobox]").fill("Ной");
  await page
    .locator('[id^="search-person-"]')
    .first()
    .dispatchEvent("mousedown", { timeout: 8000 });
  await page.getByRole("heading", { name: "Ной" }).waitFor({ timeout: 8000 });
});

await step(
  "a name that is also a book offers the book, then the namesakes by their epithets",
  async () => {
    await page.goto(BASE + "?locale=ru&year=30");
    await mapReady(page);
    await page.getByRole("button", { name: /^Поиск/ }).click();
    await page.locator("input[role=combobox]").fill("Иоанн");
    await page.locator('[id^="search-person-"]').first().waitFor({ timeout: 8000 });
    const text = await page.locator("#search-results").innerText();
    expect(
      text.indexOf("Ин") < text.indexOf("Иоанн Креститель") && text.includes("Иоанн Зеведеев"),
      text.slice(0, 120),
    );
  },
);

await step("the line of Jesus goes back to Adam", async () => {
  await page.goto(BASE + "?locale=ru&year=30");
  await mapReady(page);
  await page.getByRole("button", { name: /^Поиск/ }).click();
  await page.locator("input[role=combobox]").fill("Иисус");
  await page
    .locator('[id^="search-person-"]')
    .first()
    .dispatchEvent("mousedown", { timeout: 8000 });
  await page.getByRole("heading", { name: "Иисус" }).waitFor({ timeout: 8000 });
  expect(
    (await page.getByRole("button", { name: "Адам", exact: true }).count()) > 0,
    "no Adam in the line",
  );
});

await step("a battle's mark opens its place, whose timeline tells the battle", async () => {
  await page.goto(BASE + "?locale=ru&year=-1009&camera=35.4,32.5,8,0,0");
  await mapReady(page);
  await settled(page);
  const at = await page.evaluate(() => {
    const m = window.__hgMap;
    const f = m
      .queryRenderedFeatures({ layers: ["battle-icon"] })
      .find((x) => x.properties.place === "acf57c5");
    if (!f) return null;
    const p = m.project(f.geometry.coordinates);
    return [p.x + 14, p.y - 14];
  });
  expect(at, "no battle mark at Gilboa in 1010 BC");
  await page.mouse.click(at[0], at[1]);
  await page.getByRole("heading", { name: "Гора Гелвуй" }).waitFor({ timeout: 8000 });
  await page.getByRole("tab", { name: "Хронология" }).click();
  await page.getByText("Гибель Саула на горе Гелвуй").first().waitFor({ timeout: 5000 });
});

await step(
  "the Bible alone, in the settings, takes the ancient world off the map and the search",
  async () => {
    // Over Hattusa in a year it stood: it must be on the map before the switch.
    await page.goto(BASE + "?locale=ru&year=-1300&camera=34.6,40.0,7,0,0");
    await mapReady(page);
    const hattusa = () =>
      window.__hgMap.querySourceFeatures("places", {
        filter: ["==", ["get", "id"], "283602441"],
      }).length;
    await page.waitForFunction(hattusa, null, { timeout: 8000 });
    await page
      .getByRole("button", { name: /Настройки/ })
      .first()
      .click();
    await page.getByRole("switch", { name: /Только Библия/ }).click();
    await page.keyboard.press("Escape");
    // Hidden on the map, not in the reader's own switch: a link they share stays theirs.
    await page.waitForFunction(() => window.__hgMap.getGlobalState().bibleOnly === true, null, {
      timeout: 5000,
    });
    // The ancient sites step off the places' source, Hattusa among them.
    await page.waitForFunction(
      () =>
        window.__hgMap.querySourceFeatures("places", {
          filter: ["==", ["get", "id"], "283602441"],
        }).length === 0,
      null,
      { timeout: 5000 },
    );
    // Nothing to wait for: the setting must not reach the link at all, now or after the
    // pause the app writes the link after.
    await page.waitForTimeout(500);
    expect(!search().get("hide")?.includes("ancient"), `hide=${search().get("hide")}`);
    await page.getByRole("button", { name: "Поиск места" }).click();
    await page.getByRole("combobox").fill("Хаттуса");
    // The search has answered: it says it found nothing, and offers no option.
    await page.getByText(EMPTY_SEARCH).waitFor({ timeout: 8000 });
    expect((await page.getByRole("option").count()) === 0, "an ancient site was offered");
    await page.evaluate(() => localStorage.removeItem("hg:bible-only"));
  },
);

await step("a voyage gives the days the text gives, with the verse", async () => {
  // Paul's third journey, stop 4: Philippi to Troas, «дней в пять» (Acts 20:6).
  await page.goto(BASE + "?tour=paul-3&stop=4&locale=ru");
  await mapReady(page);
  await page.getByText(/по морю, ≈\u00a05 дней \(Деян\u00a020:6\)/).waitFor({ timeout: 8000 });
});

await step("a place's card links the questions answered with it on the map", async () => {
  await page.goto(BASE + "?locale=ru&year=30&place=a70fd5d");
  await mapReady(page);
  const link = page.getByRole("link", { name: /Где находилась Ниневия\?/ });
  await link.waitFor({ timeout: 8000 });
  const href = await link.getAttribute("href");
  expect(href?.endsWith("/ru/q/where-was-nineveh/") === true, `href=${String(href)}`);
});

await step("the article and answer pages name their licence; a thin page does not", async () => {
  // ADR 0016: the site's own texts are CC BY-NC-ND, in the head and at the foot.
  const lic = 'link[rel="license"][href="https://creativecommons.org/licenses/by-nc-nd/4.0/"]';
  for (const [path, words] of [
    ["ru/place/jerusalem/", "Текст статьи: © History Globe"],
    ["ru/q/where-was-nineveh/", "Текст ответа: © History Globe"],
  ]) {
    await page.goto(BASE + path);
    expect((await page.locator(`head ${lic}`).count()) === 1, `${path}: no licence in the head`);
    const foot = (await page.locator("footer .lic").textContent()) ?? "";
    expect(foot.startsWith(words) && foot.endsWith("CC BY-NC-ND 4.0"), `${path}: «${foot}»`);
  }
  await page.goto(BASE + "en/places/");
  const thin = await page
    .locator("ul li:not(.art) a[href^='../place/']")
    .first()
    .getAttribute("href");
  await page.goto(BASE + "en/places/" + String(thin));
  expect((await page.locator("footer .lic").count()) === 0, `${String(thin)} has a licence line`);
});

await step(
  "the quiz plays on screen: a choice shows the right place, the end the score",
  async () => {
    await page.goto(BASE + "?tour=paul-1&locale=ru");
    await mapReady(page);
    await page.getByRole("button", { name: /^Ещё/ }).click();
    await page.getByRole("button", { name: /Викторина на экране/ }).click();
    await page.getByText(/Вопрос 1 из/).waitFor({ timeout: 15000 });
    const options = page.getByRole("group", { name: "Где это было?" }).getByRole("button");
    await options.first().click();
    await page.getByText(/^Верно!$|^Нет, это /).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: "Закрыть" }).first().click();
  },
);

await step("a quiz prints for a tour, the place never named in its own question", async () => {
  await page.goto(BASE + "?tour=paul-1&locale=ru");
  await mapReady(page);
  // Printing is the browser's: here the sheet is only built and read.
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.getByRole("button", { name: /^Ещё/ }).click();
  await page.getByRole("button", { name: /Викторина для учеников/ }).click();
  await page
    .locator("#hg-print .hg-quiz li")
    .first()
    .waitFor({ state: "attached", timeout: 15000 });
  const text = await page.locator("#hg-print").textContent();
  expect(/Ответы:/.test(text ?? ""), "no answers at the foot");
  const q = await page.locator("#hg-print .hg-quiz li").count();
  expect(q >= 8, `${String(q)} questions`);
  await page.evaluate(() => {
    document.getElementById("hg-print")?.remove();
  });
});

await step("a tour told outside the Bible prints a quiz too", async () => {
  await page.goto(BASE + "?tour=jewish-war&locale=ru");
  await mapReady(page);
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.getByRole("button", { name: /^Ещё/ }).click();
  await page.getByRole("button", { name: /Викторина для учеников/ }).click();
  await page
    .locator("#hg-print .hg-quiz li")
    .first()
    .waitFor({ state: "attached", timeout: 15000 });
  const q = await page.locator("#hg-print .hg-quiz li").count();
  expect(q >= 8, `${String(q)} questions`);
  await page.evaluate(() => {
    document.getElementById("hg-print")?.remove();
  });
});

await step("a book whose short name an ancient site shares is still a chapter", async () => {
  // «Ис» is Issus in Serbian; Isaiah's abbreviation in Russian must still find the chapter (Tyre, Sidon).
  await page.goto(BASE + "?locale=ru");
  await mapReady(page);
  await page.getByRole("button", { name: "Поиск места" }).click();
  await page.getByRole("combobox").fill("Ис 23");
  await page.getByRole("option", { name: /Ис 23/ }).first().waitFor({ timeout: 5000 });
});

await step("a person's card offers their tours, and one starts", async () => {
  await page.goto(BASE + "?locale=ru");
  await mapReady(page);
  await page.getByRole("button", { name: "Поиск места" }).click();
  await page.getByPlaceholder("Место, человек, глава или год").fill("Павел");
  await page
    .getByRole("option", { name: /^Павел/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Экскурсии" }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Первое путешествие Павла/ }).click();
  await until(() => search().get("tour") === "paul-1", `tour=${search().get("tour")}`);
});

await step("Back closes a chapter opened after the map", async () => {
  await page.goto(BASE + "?locale=ru");
  await mapReady(page);
  await settled(page);
  await page.getByRole("button", { name: "Поиск места" }).click();
  // The search itself, not the field that stands in while it loads.
  await page.getByRole("combobox").fill("Деян 16");
  await page.getByRole("option", { name: /Деян/ }).first().waitFor({ timeout: 5000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.search.includes("ref=Acts.16"), null, {
    timeout: 8000,
  });
  await page.goBack();
  await until(() => !search().has("ref"), `ref=${search().get("ref")}`);
  await until(
    async () =>
      (await page.getByRole("button", { name: /Закрыть и показать всю карту/ }).count()) === 0,
    "the chapter's chip is still there",
  );
});

await step("a lesson is built from place cards, named, and runs as a tour", async () => {
  for (const id of ["a15257a", "a112427"]) {
    await page.goto(BASE + `?locale=ru&year=30&place=${id}`);
    await mapReady(page);
    await page.getByRole("button", { name: /В урок/ }).click({ timeout: 8000 });
  }
  await page.getByRole("textbox", { name: /Название урока/ }).fill("Путь в Вифлеем");
  // A link: the page loads anew. Waited for by its address first, or the wait for the map
  // can catch the old page as it goes (it timed out once under load).
  await page.getByRole("link", { name: "Начать" }).click();
  await page.waitForURL(/tour=lesson/, { timeout: 15000 });
  await mapReady(page);
  await page.getByText("Путь в Вифлеем").first().waitFor({ timeout: 8000 });
  expect(search().get("title") === "Путь в Вифлеем", `title=${search().get("title")}`);
  expect(search().get("tour") === "lesson", `tour=${search().get("tour")}`);
  expect(
    (search().get("lesson") ?? "").startsWith("a15257a~30."),
    `lesson=${search().get("lesson")}`,
  );
  await page.getByRole("button", { name: /Дальше/ }).click();
  await page.getByRole("heading", { name: "Вифлеем" }).waitFor({ timeout: 8000 });
  // Cleared for the next run of the checks.
  await page.evaluate(() => {
    localStorage.removeItem("hg:lesson");
    localStorage.removeItem("hg:lesson-title");
  });
});

await step("the distance tool measures from one opened place to the next", async () => {
  await page.goto(BASE + "?locale=ru&year=30&place=a15257a");
  await mapReady(page);
  // The card's ruler opens the tool with this place as the first end.
  await page.getByRole("button", { name: "Расстояние отсюда" }).click({ timeout: 8000 });
  await page.getByText("Теперь второе").waitFor({ timeout: 8000 });
  await page
    .getByRole("button", { name: /Поиск|Найти/ })
    .first()
    .click();
  await page.keyboard.type("Вифлеем");
  await page
    .getByRole("option", { name: /Вифлеем/ })
    .first()
    .waitFor({ timeout: 8000 });
  await page.keyboard.press("Enter");
  await page.getByText(/^\d+ км по прямой$/).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Закрыть инструменты" }).click();
});

await step("a question's link opens the distance tool between its two places", async () => {
  // Jerusalem to Jericho (Tell el-Alayiq), as /ru/q/how-far-jerusalem-to-jericho/ links it.
  await page.goto(BASE + "?locale=ru&year=30&ref=Luke.10.30&measure=a15257a,aaf03fa");
  await mapReady(page);
  await page.getByText("21 км по прямой").waitFor({ timeout: 8000 });
  const panel = page.locator("#tools-panel");
  expect(await panel.getByText("Иерусалим").count(), "the first end is Jerusalem");
  expect(await panel.getByText("Иерихон").count(), "the second end is Jericho");
  await until(() => search().get("measure") === "a15257a,aaf03fa", "the link keeps the distance");
  await page.getByRole("button", { name: "Закрыть инструменты" }).click();
  await until(
    () => !search().has("measure"),
    "closing the tool takes the distance out of the link",
  );
});

await step(
  "a map-only frame: no card, no chapter bar; the host selects, clears and hears clicks",
  async () => {
    // A host page holding the frame (the docs page, emptied): messages both ways.
    await page.goto(BASE + "docs/");
    await page.evaluate((src) => {
      document.body.innerHTML = "";
      window.__msgs = [];
      window.addEventListener("message", (e) => window.__msgs.push(e.data));
      const f = document.createElement("iframe");
      f.src = src;
      f.style.cssText = "width:1000px;height:640px;border:0";
      document.body.append(f);
    }, BASE + "?embed=1&ui=map&ref=Acts.16&locale=ru&year=30");
    await page.waitForFunction(() => window.__msgs.some((m) => m?.type === "hg:ready"), null, {
      timeout: 45000,
    });
    const frame = page.frames().find((f) => f !== page.mainFrame());
    const views = () =>
      page.evaluate(() =>
        window.__msgs.filter((m) => m?.type === "hg:view-changed").map((m) => m.view),
      );
    const send = (view) =>
      page.evaluate((view) => {
        document
          .querySelector("iframe")
          .contentWindow.postMessage({ type: "hg:set-view", v: 1, view }, "*");
      }, view);
    // Neither the card nor the chapter's chip, only the link, named for what it is.
    expect((await frame.locator("section.hg-card").count()) === 0, "a card section is there");
    expect((await frame.getByRole("button", { name: /Деян/ }).count()) === 0, "the chapter chip");
    const nav = await frame.locator("nav").first().getAttribute("aria-label");
    expect(nav === "Ссылка на полный глобус", `nav label ${nav}`);
    // The host selects Capernaum: the place goes out in the view and wears the ring.
    await send({ place: "af2161c" });
    await page.waitForFunction(
      () => window.__msgs.some((m) => m?.type === "hg:view-changed" && m.view.place === "af2161c"),
      null,
      { timeout: 10000 },
    );
    expect((await frame.locator(".hg-ring").count()) === 1, "no ring on the selected place");
    expect((await frame.locator("section.hg-card").count()) === 0, "a card opened");
    // The map's flight ends before a point on it is read: during it the place moves away.
    const still = () =>
      frame.waitForFunction(() => !window.__hgMap.isMoving() && window.__hgMap.loaded(), null, {
        timeout: 15000,
      });
    const capernaum = async () => {
      await still();
      return frame.evaluate(() => {
        const m = window.__hgMap;
        const f = m.queryRenderedFeatures().find((x) => x.properties?.id === "af2161c");
        return f && m.project(f.geometry.coordinates);
      });
    };
    // A click on the place itself, twice: hg:place-clicked each time.
    const box = await page.locator("iframe").boundingBox();
    const clicks = () =>
      page.evaluate(
        () =>
          window.__msgs.filter((m) => m?.type === "hg:place-clicked" && m.place === "af2161c")
            .length,
      );
    for (let i = 0; i < 2; i++) {
      const at = await capernaum();
      expect(at, "Capernaum is not drawn");
      await page.mouse.click(box.x + at.x, box.y + at.y);
      await until(async () => (await clicks()) === i + 1, `${await clicks()} hg:place-clicked`);
    }
    // `place: null` clears it: the view goes out without a place, and the ring goes.
    await send({ place: null });
    await page.waitForFunction(
      () => {
        const v = window.__msgs.filter((m) => m?.type === "hg:view-changed").at(-1)?.view;
        return v && !("place" in v);
      },
      null,
      { timeout: 10000 },
    );
    expect((await frame.locator(".hg-ring").count()) === 0, "the ring stayed");
    // Selected again, then a click on the map away from any place clears it too.
    await send({ place: "af2161c" });
    await page.waitForFunction(
      () =>
        window.__msgs.filter((m) => m?.type === "hg:view-changed").at(-1)?.view.place === "af2161c",
      null,
      { timeout: 10000 },
    );
    await still();
    const emptySpot = () =>
      frame.evaluate(() => {
        const m = window.__hgMap;
        for (let y = 120; y < 520; y += 20)
          for (let x = 80; x < 900; x += 20)
            if (
              m
                .queryRenderedFeatures([
                  [x - 14, y - 14],
                  [x + 14, y + 14],
                ])
                .every((f) => !f.properties?.id && !f.layer.id.includes("battle"))
            )
              return { x, y };
        return null;
      });
    const empty = await emptySpot();
    expect(empty, "no empty spot on the map");
    // A double-click there zooms and keeps the place.
    const zoom = await frame.evaluate(() => window.__hgMap.getZoom());
    await page.mouse.dblclick(box.x + empty.x, box.y + empty.y);
    await frame.waitForFunction((z) => window.__hgMap.getZoom() > z, zoom, { timeout: 8000 });
    await still();
    expect(
      await frame.evaluate(() => document.querySelector(".hg-ring") !== null),
      "a double-click cleared the place",
    );
    const spot = await emptySpot();
    expect(spot, "no empty spot on the map after the zoom");
    await page.mouse.click(box.x + spot.x, box.y + spot.y);
    await page.waitForFunction(
      () => {
        const v = window.__msgs.filter((m) => m?.type === "hg:view-changed").at(-1)?.view;
        return v && !("place" in v);
      },
      null,
      { timeout: 10000 },
    );
    expect((await views()).length > 0, "no hg:view-changed at all");
  },
);

// The keyboard and a screen reader: a card takes the focus from what opened it and gives it
// back on Esc; the live region says what opened and how many results the search found.
/** What has the focus: its tag and its name. */
const focused = () =>
  page.evaluate(() => {
    const a = document.activeElement;
    return `${a?.tagName ?? ""} ${(a?.getAttribute("aria-label") ?? a?.textContent ?? "").trim()}`;
  });
const said = () => page.locator("#hg-live").textContent();
await step("keyboard: a search result opens its card on its title, Esc goes back", async () => {
  await page.goto(BASE + "?locale=ru");
  await mapReady(page);
  await page.getByRole("button", { name: "Поиск места" }).click();
  await page.getByPlaceholder("Место, человек, глава или год").fill("Капер");
  await page.getByRole("option").first().waitFor({ timeout: 8000 });
  await until(async () => /^\d+ результат/.test(await said()), "the results were not counted");
  await page.keyboard.press("Enter");
  await until(async () => (await focused()) === "H2 Капернаум", "the title did not take the focus");
  await until(async () => (await said()) === "Открыто: Капернаум", "the card was not announced");
  // The card's zoom is named for its place, apart from the map's own "Zoom in".
  await page.getByRole("button", { name: "Приблизить: Капернаум" }).waitFor({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await until(
    async () => /^BUTTON Поиск места/.test(await focused()),
    "the focus did not go back to the search",
  );
});
await step(
  "keyboard: a tour started from the overview opens on its stop, Esc goes back",
  async () => {
    await overview();
    await page.getByRole("tab", { name: "Экскурсии" }).click();
    await page.locator("#overview-panel button", { hasText: "Путь Авраама" }).focus();
    await page.keyboard.press("Enter");
    await until(
      async () =>
        /^H2 /.test(await focused()) &&
        (await page.locator("section.hg-card h2:focus").count()) === 1,
      `the stop's title did not take the focus: ${await focused()}`,
    );
    await until(
      async () => /^Открыто: Путь Авраама\. Остановка 1 из \d+$/.test(await said()),
      "the tour was not announced",
    );
    await page.keyboard.press("Escape");
    await until(
      async () => /^BUTTON Обзор/.test(await focused()),
      "the focus did not go back to the overview's book",
    );
  },
);
await step("keyboard: a place's names in its article are not stops for Tab", async () => {
  // Jerusalem's article names many places: they mark the map under the pointer only.
  await page.goto(BASE + "?locale=ru&place=a15257a");
  await mapReady(page);
  await page
    .getByRole("tab", { name: /^История/ })
    .first()
    .click();
  await page.locator("section.hg-card p span.underline").first().waitFor({ timeout: 8000 });
  expect(
    (await page.locator("section.hg-card p span[tabindex]").count()) === 0,
    "a name in the article is focusable",
  );
  await page.keyboard.press("Escape");
});

// A large frame without ui=map has the site's column on the left: as tall as the map and
// empty but for its panels. The place the host selects lands under it.
// A first visit, in a context of its own: what the steps above remembered (the overview
// open, say) would make room for it and take the place out from under the column.
const host = await newPage(browser);
host.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
let bigFrame = null;
await step(
  "a large frame without ui=map: a click on the selected place under the column reaches it",
  async () => {
    await host.goto(BASE + "docs/");
    await host.evaluate((src) => {
      document.body.innerHTML = "";
      document.body.style.margin = "0";
      window.__msgs = [];
      window.addEventListener("message", (e) => window.__msgs.push(e.data));
      const f = document.createElement("iframe");
      f.src = src;
      f.style.cssText = "width:1200px;height:800px;border:0;display:block";
      document.body.append(f);
    }, BASE + "embed/v1?place=af2161c&locale=ru");
    await host.waitForFunction(() => window.__msgs.some((m) => m?.type === "hg:ready"), null, {
      timeout: 45000,
    });
    bigFrame = host.frames().find((f) => f !== host.mainFrame());
    const frame = bigFrame;
    expect((await frame.locator("aside").count()) === 1, "no column in a large frame");
    // Not map-only: the place opens our card, and the map stands still on it.
    await frame.getByRole("heading", { name: "Капернаум" }).waitFor({ timeout: 10000 });
    await frame.waitForFunction(() => window.__hgMap.loaded() && !window.__hgMap.isMoving(), null, {
      timeout: 20000,
    });
    const at = await frame.evaluate(() => {
      const m = window.__hgMap;
      const f = m.queryRenderedFeatures().find((x) => x.properties?.id === "af2161c");
      const p = f && m.project(f.geometry.coordinates);
      if (!p) return null;
      const col = document.querySelector("aside").getBoundingClientRect();
      const under = p.x >= col.left && p.x <= col.right && p.y >= col.top && p.y <= col.bottom;
      return { x: p.x, y: p.y, under, top: document.elementFromPoint(p.x, p.y)?.tagName };
    });
    expect(at, "Capernaum is not drawn");
    // The case the step is for: the place within the column's box, the map on top there.
    expect(
      at.under,
      `the place at ${Math.round(at.x)},${Math.round(at.y)} is not under the column`,
    );
    expect(at.top === "CANVAS", `${at.top} over the place, not the map`);
    const box = await host.locator("iframe").boundingBox();
    await host.mouse.click(box.x + at.x, box.y + at.y);
    await host.waitForFunction(
      () => window.__msgs.some((m) => m?.type === "hg:place-clicked" && m.place === "af2161c"),
      null,
      { timeout: 5000 },
    );
  },
);
await step("a large frame without ui=map: the column's panels still take clicks", async () => {
  expect(bigFrame, "no frame from the step before");
  const frame = bigFrame;
  const book = frame.getByRole("button", { name: /^Обзор/ });
  if ((await book.getAttribute("aria-expanded")) !== "true") await book.click();
  await until(
    async () => (await book.getAttribute("aria-expanded")) === "true",
    "the overview did not open",
  );
  const tab = frame.getByRole("tab", { name: "События" });
  await tab.click();
  await until(
    async () => (await tab.getAttribute("aria-selected")) === "true",
    "the events tab is not selected",
  );
  await frame.getByRole("tab", { name: "Экскурсии" }).click();
  await frame.getByText("Земная жизнь Иисуса").click({ timeout: 3000 });
  await host.waitForFunction(
    () => window.__msgs.some((m) => m?.type === "hg:view-changed" && m.view.tour),
    null,
    { timeout: 5000 },
  );
});
await host.context().close();
await step(
  "the column lets the map have its empty part, and takes it back when it scrolls",
  async () => {
    // A short window: the overview makes the column taller than it is.
    const low = await newPage(browser, { width: 1440, height: 620 });
    try {
      await low.goto(BASE + "?locale=ru&ref=Acts.16");
      await mapReady(low);
      const column = low.locator("aside");
      const top = () =>
        low.evaluate(() => {
          const r = document.querySelector("aside").getBoundingClientRect();
          // The column's right edge, where its scrollbar runs, below the header.
          return document.elementFromPoint(r.right - 4, r.top + 120)?.tagName;
        });
      const book = low.getByRole("button", { name: /^Обзор/ });
      if ((await book.getAttribute("aria-expanded")) === "true") await book.click();
      await until(
        async () => (await column.getAttribute("data-scrolls")) === null,
        "an empty column scrolls",
      );
      await until(
        async () => (await top()) === "CANVAS",
        `${await top()} over the map beside the column`,
      );
      await book.click();
      await low.getByRole("tab", { name: "Экскурсии" }).click();
      await low.waitForFunction(() => document.querySelector("aside").hasAttribute("data-scrolls"));
      expect((await top()) === "ASIDE", `${await top()} where the column's scrollbar runs`);
      await low.mouse.move(200, 38);
      await low.mouse.wheel(0, 300);
      await until(
        async () => (await column.evaluate((el) => el.scrollTop)) > 0,
        "the wheel over a panel does not scroll the column",
      );
    } finally {
      await low.context().close();
    }
  },
);

// A phone upright (390 x 844): the card takes the lower part of the screen, and what it is
// about has to stay on the map above it, where a finger can still reach the map.
const phone = await newPage(browser, { width: 390, height: 844 });
phone.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
/** Where a place is drawn, and what is on top of the screen there: the map, or a panel. */
const onMap = (id) =>
  phone.evaluate((id) => {
    const m = window.__hgMap;
    const f = m.queryRenderedFeatures().find((x) => x.properties?.id === id);
    if (!f) return null;
    const p = m.project(f.geometry.coordinates);
    const card = document.querySelector("section.hg-card")?.getBoundingClientRect();
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      top: document.elementFromPoint(p.x, p.y)?.tagName,
      cardTop: card && card.height > 0 ? Math.round(card.top) : null,
    };
  }, id);
async function visibleOnPhone(id, what) {
  await mapReady(phone);
  await settled(phone, 25_000);
  const at = await onMap(id);
  expect(at, `${what} is not drawn`);
  expect(at.top === "CANVAS", `${at.top} over ${what} at ${at.x},${at.y}`);
  expect(
    at.cardTop !== null && at.y < at.cardTop,
    `${what} at y ${at.y}, the card at ${at.cardTop}`,
  );
}
await step("phone: a place's card leaves the place on the map above it", async () => {
  await phone.goto(BASE + "?locale=ru&year=30&place=a15257a");
  await phone.getByRole("heading", { name: "Иерусалим" }).waitFor({ timeout: 10000 });
  await visibleOnPhone("a15257a", "Jerusalem");
});
await step("phone: a tour's stop stays on the map above its card", async () => {
  // Paul's second journey at Troas: a stop with the relief of its leg and a long line.
  await phone.goto(BASE + "?locale=ru&tour=paul-2&stop=4");
  await phone.getByRole("heading", { name: "Троада" }).waitFor({ timeout: 10000 });
  await visibleOnPhone("a91c509", "Troas");
  // The stepping stays in reach under the stop's text, however long it is.
  const next = await phone.getByRole("button", { name: /^Дальше/ }).boundingBox();
  expect(next && next.y + next.height <= 844, `Next at ${JSON.stringify(next)}`);
});
await step("phone: the distance between two places picked on the map by tap", async () => {
  await phone.goto(BASE + "?locale=ru&year=30&ref=Luke.10");
  await mapReady(phone);
  await phone.getByRole("button", { name: "Инструменты" }).click();
  await phone.getByRole("button", { name: /^Расстояние/ }).click();
  await phone.getByText("Выберите первое место").waitFor({ timeout: 8000 });
  // A place drawn on the open map, not under a panel, and not the one picked before.
  const pick = async (not) => {
    await settled(phone, 25_000);
    const at = await phone.evaluate((not) => {
      const m = window.__hgMap;
      for (const f of m.queryRenderedFeatures()) {
        const id = f.properties?.id;
        if (!id || id === not || f.geometry.type !== "Point") continue;
        const p = m.project(f.geometry.coordinates);
        if (p.x < 30 || p.x > 360 || p.y < 0 || p.y > 844) continue;
        if (document.elementFromPoint(p.x, p.y)?.tagName === "CANVAS") return { id, ...p };
      }
      return null;
    }, not);
    expect(at, "no place to pick on the open map");
    await phone.mouse.click(at.x, at.y);
    return at.id;
  };
  const first = await pick(null);
  await phone.getByText("Теперь второе").waitFor({ timeout: 8000 });
  // The first pick opened no card over the map: the second is still in reach.
  expect((await phone.locator("section.hg-card h2").count()) === 0, "a card opened");
  await pick(first);
  await phone.getByText(/^\d+ км по прямой$/).waitFor({ timeout: 8000 });
  // The picks leave no place selected: a link copied now opens no card.
  await until(async () => {
    const url = await phone.evaluate(() => location.search);
    return !new URLSearchParams(url).has("place");
  }, "a pick left place= in the link");
  await phone.getByRole("button", { name: "Закрыть инструменты" }).click();
  // Closed, the tool gives back the map, not the last pick's card.
  await phone.waitForTimeout(500);
  expect((await phone.locator("section.hg-card h2").count()) === 0, "a card opened on close");
});
await step("phone: the rulers' band and a tour's dots are 24 px high to a finger", async () => {
  await phone.goto(BASE + "?locale=ru&year=30&place=a15257a");
  const band = phone.locator("section.hg-card [role=toolbar]");
  await band.waitFor({ timeout: 10000 });
  const runs = band.locator("button[data-run]");
  const heights = await runs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.length > 1 && heights.every((h) => h >= 24), `heights ${heights.join(",")}`);
  // A tap just left of the band goes to the nearest age, the first, and names it below.
  const first = await runs.first().getAttribute("aria-label");
  await band.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = { bubbles: true, clientX: r.left + 1, clientY: r.top + 2 };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...at, pointerType: "touch" }));
    el.dispatchEvent(new MouseEvent("click", { ...at, detail: 1 }));
  });
  await until(
    async () => (await band.evaluate((el) => el.nextElementSibling?.textContent)) === first,
    `the tap did not name ${first}`,
  );
  await phone.goto(BASE + "?locale=ru&tour=paul-2&stop=4");
  const dots = phone.locator("section.hg-card ol button");
  await dots.first().waitFor({ timeout: 10000 });
  const dotHeights = await dots.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().height),
  );
  expect(
    dotHeights.every((h) => h >= 24),
    `dots ${dotHeights.join(",")}`,
  );
});
await step("phone: the folded year names the age it shows", async () => {
  // A card open on a phone folds the player to its year and age (WCAG 2.5.3).
  await phone.goto(BASE + "?locale=ru&year=30&place=a15257a");
  const pill = phone.getByRole("button", { name: /\. Показать шкалу времени$/ });
  await pill.waitFor({ timeout: 10000 });
  const [name, shown] = await pill.evaluate((b) => [
    b.getAttribute("aria-label") ?? "",
    b.innerText,
  ]);
  const words = shown.replace(/\s+/g, " ").trim();
  expect(name.startsWith(words), `"${name}" does not begin with "${words}"`);
});
await step("phone on its side: a tour's stepping stays on screen", async () => {
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.goto(BASE + "?locale=ru&tour=paul-2&stop=4");
  await phone.getByRole("heading", { name: "Троада" }).waitFor({ timeout: 10000 });
  await settled(phone, 25_000);
  const next = await phone.getByRole("button", { name: /^Дальше/ }).boundingBox();
  expect(next && next.y + next.height <= 390, `Next at ${JSON.stringify(next)}`);
});
await phone.context().close();

console.log(results.join("\n"));
console.log(errors.length ? [...new Set(errors)].join("\n") : "no page errors");
await browser.close();
if (results.some((r) => r.startsWith("FAIL")) || errors.length) process.exitCode = 1;
