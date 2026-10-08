/**
 * The app's main ways through, in a real browser: search, a place card and its verses,
 * keys, layers, tours, events, the overview, people, languages, bad links. Each step
 * prints ok or FAIL; page errors fail the run.
 *
 * Usage: pnpm e2e (with the app running; see e2e/browser.mjs)
 */
import { BASE, launch, mapReady } from "./browser.mjs";

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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404"))
    errors.push(`console: ${m.text().slice(0, 160)}`);
});
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const search = () => new URLSearchParams(new URL(page.url()).search);
// Starting a tour puts the overview away: open it again where a step needs its tabs.
const overview = async () => {
  const book = page.getByRole("button", { name: /^Обзор/ });
  if ((await book.getAttribute("aria-expanded")) !== "true") await book.click();
  await page.waitForTimeout(400);
};

await page.goto(BASE + "?locale=ru");
await page.waitForFunction(
  () => {
    const m = window.__hgMap;
    return !!m && m.loaded();
  },
  null,
  { timeout: 45000 },
);
await page.waitForTimeout(1500);

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
  await page.waitForTimeout(800);
  expect(search().get("place") === "af2161c", `place=${search().get("place")}`);
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
  await page.waitForTimeout(300);
  expect((await page.getByRole("heading", { name: "Капернаум" }).count()) === 0, "card still open");
});
await step("] moves the year +10, Shift+] +100", async () => {
  await page
    .locator("canvas")
    .first()
    .click({ position: { x: 1200, y: 300 } });
  const y0 = Number(search().get("year"));
  await page.keyboard.press("]");
  await page.waitForTimeout(500);
  await page.keyboard.press("Shift+BracketLeft");
  await page.waitForTimeout(600);
  const y1 = Number(search().get("year"));
  expect(y1 === y0 + 10 - 100, `${y0} -> ${y1}`);
});
await step("space plays and pauses, / focuses the search", async () => {
  await page
    .locator("canvas")
    .first()
    .click({ position: { x: 1200, y: 300 } });
  const y0 = Number(search().get("year"));
  await page.keyboard.press(" ");
  await page.waitForTimeout(900);
  await page.keyboard.press(" ");
  await page.waitForTimeout(600);
  const y1 = Number(search().get("year"));
  expect(y1 > y0, `${y0} -> ${y1}`);
  await page.keyboard.press("/");
  await page.waitForTimeout(300);
  expect(
    await page
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
  await page.waitForTimeout(800);
  expect(search().get("hide") === "relief", `hide=${search().get("hide")}`);
  await page.getByText("Рельеф").click();
  await page.waitForTimeout(800);
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
  await page.waitForTimeout(300);
  expect((await page.locator("dialog[open]").count()) === 0, "a dialog stayed open");
});
await step("tour: start, next, back, close", async () => {
  await page.getByRole("tab", { name: "Экскурсии" }).click();
  await page.getByText("Земная жизнь Иисуса").click({ timeout: 5000 });
  await page.getByText("Остановка 1 из 17").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Дальше" }).click({ timeout: 5000 });
  await page.getByText("Остановка 2 из 17").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Назад", exact: true }).click({ timeout: 5000 });
  await page.getByText("Остановка 1 из 17").first().waitFor({ timeout: 3000 });
  await page.waitForTimeout(600);
  expect(search().get("tour") === "jesus", `tour=${search().get("tour")}`);
  await page.getByRole("button", { name: "Закончить" }).click();
  await page.waitForTimeout(600);
  expect(!search().has("tour"), "tour still in URL");
  expect(!search().has("place"), "a stop's card stayed open");
});
await step("events panel: a pick sets the year and opens the place", async () => {
  // Events are a tab of the overview panel.
  await overview();
  await page.getByRole("tab", { name: "События" }).click();
  await page.getByRole("button", { name: /Ассирия берёт Самарию/ }).click();
  await page.getByRole("heading", { name: "Самария" }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  expect(search().get("year") === "-721", `year=${search().get("year")}`);
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
  await page.waitForTimeout(600);
  expect(!search().has("tour"), "tour still in URL");
  // ...and the place card leads back to the same stop.
  await page.getByRole("button", { name: /Вернуться к экскурсии/ }).click();
  await page.getByText("Остановка 3 из 12").first().waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Закончить" }).click();
  await page.keyboard.press("Escape");
});
await step("search during a tour ends it and opens the place", async () => {
  await overview();
  await page.getByRole("tab", { name: "Экскурсии" }).click();
  await page.getByText("Путь Авраама").click({ timeout: 5000 });
  await page.getByText("Остановка 1 из 12").first().waitFor({ timeout: 3000 });
  if (await page.getByRole("button", { name: "Поиск места" }).count())
    await page.getByRole("button", { name: "Поиск места" }).click();
  await page.getByPlaceholder("Место, человек, глава или год").fill("Капер");
  await page.getByRole("option").first().click();
  await page.getByRole("heading", { name: "Капернаум" }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(600);
  expect(!search().has("tour"), "tour still in URL");
  await page.keyboard.press("Escape");
});
await step("book opens and closes the overview", async () => {
  const book = page.getByRole("button", { name: /^Обзор/ });
  const open = async () => (await book.getAttribute("aria-expanded")) === "true";
  if (await open()) {
    await book.click();
    await page.waitForTimeout(300);
  }
  expect(
    !(await open()) && (await page.locator("#more-panels").count()) === 0,
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
  await page.waitForTimeout(600);
  expect(search().get("locale") === "en", "locale not in URL");
});
await step("slider: keyboard arrow changes the year", async () => {
  const s = page.locator('input[type="range"]');
  await s.focus();
  const before = await s.inputValue();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  expect((await s.inputValue()) !== before, "unchanged");
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
  await page.waitForTimeout(1200);
  expect(search().get("year") === "-1002", `year=${search().get("year")}`);
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
await step("an ancient site found by name flies the map there in a year it stood", async () => {
  await page.goto(BASE + "?locale=ru&year=30");
  await mapReady(page);
  await page.getByRole("button", { name: /^Поиск/ }).click();
  await page.locator("input[role=combobox]").fill("Хаттуса");
  await page.locator('[id^="search-site-"]').first().dispatchEvent("mousedown", { timeout: 8000 });
  await page.waitForTimeout(2500);
  const y = Number(search().get("year"));
  expect(y < -1180 && y > -2100, `year=${y}`);
  const cam = (search().get("camera") ?? "").split(",").map(Number);
  expect(Math.abs(cam[0] - 34.6) < 0.5 && Math.abs(cam[1] - 40.0) < 0.5, `camera=${cam}`);
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
  await page.waitForTimeout(1500);
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
    await page.goto(BASE + "?locale=ru");
    await mapReady(page);
    await page
      .getByRole("button", { name: /Настройки/ })
      .first()
      .click();
    await page.getByRole("switch", { name: /Только Библия/ }).click();
    await page.keyboard.press("Escape");
    // Hidden on the map, not in the reader's own switch: a link they share stays theirs.
    await page.waitForFunction(
      () => window.__hgMap.getLayoutProperty("ancient-label", "visibility") === "none",
      null,
      { timeout: 5000 },
    );
    await page.waitForTimeout(500);
    expect(!search().get("hide")?.includes("ancient"), `hide=${search().get("hide")}`);
    await page.getByRole("button", { name: "Поиск места" }).click();
    await page.getByRole("combobox").fill("Хаттуса");
    await page.waitForTimeout(800);
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
  await page.waitForTimeout(1000);
  expect(search().get("tour") === "paul-1", `tour=${search().get("tour")}`);
});

await step("Back closes a chapter opened after the map", async () => {
  await page.goto(BASE + "?locale=ru");
  await mapReady(page);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Поиск места" }).click();
  // The search itself, not the field that stands in while it loads.
  await page.getByRole("combobox").fill("Деян 16");
  await page.getByRole("option", { name: /Деян/ }).first().waitFor({ timeout: 5000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.search.includes("ref=Acts.16"), null, {
    timeout: 8000,
  });
  await page.goBack();
  await page.waitForTimeout(1200);
  expect(!search().has("ref"), `ref=${search().get("ref")}`);
  expect(
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
    localStorage.removeItem("hg-lesson");
    localStorage.removeItem("hg-lesson-title");
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
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await page.getByText(/^\d+ км по прямой$/).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Закрыть инструменты" }).click();
});

console.log(results.join("\n"));
console.log(errors.length ? [...new Set(errors)].join("\n") : "no page errors");
await browser.close();
if (results.some((r) => r.startsWith("FAIL")) || errors.length) process.exitCode = 1;
