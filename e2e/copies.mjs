/**
 * The beacon and the honeypot (ADR 0017, addendum) in a real browser, against a build of the
 * site (vite preview). The site itself, its embed and a preview send no beacon and show no
 * line; the honeypot's link is in the page and no reader sees it; a copy of the app's page
 * and of a built page on another host, served with the site's own Content-Security-Policy,
 * asks historyglobe.app for /origin/<host> and shows where the original is. The other
 * hosts are played by routes: nothing leaves the machine.
 *
 * Usage: HG_URL=http://localhost:4173/ pnpm e2e:copies (with `vite preview` of a build
 * running; see e2e/browser.mjs for PLAYWRIGHT)
 */
import { readFileSync } from "node:fs";
import { BASE, launch } from "./browser.mjs";

const vercel = JSON.parse(
  readFileSync(new URL("../apps/web/vercel.json", import.meta.url), "utf8"),
);
const csp = vercel.headers
  .find((h) => h.source === "/((?!embed/).*)")
  .headers.find((h) => h.key === "Content-Security-Policy").value;

const browser = await launch();
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e.message).split("\n")[0].slice(0, 300)}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  serviceWorkers: "block",
});
/** What the beacon asked historyglobe.app for, by the page that asked. */
const beacons = [];
await ctx.route("https://historyglobe.app/**", (route) => {
  beacons.push(new URL(route.request().url()).pathname);
  route.fulfill({ status: 404, body: "" });
});
await ctx.route("https://tiles.mapterhorn.com/**", (route) => route.abort());
/** Another host, played by the build: every request answered from BASE, pages with the site's CSP. */
async function playHost(host) {
  await ctx.route(`https://${host}/**`, async (route) => {
    const u = new URL(route.request().url());
    const r = await ctx.request.get(BASE + u.pathname.slice(1) + u.search);
    const headers = { "content-type": r.headers()["content-type"] ?? "application/octet-stream" };
    if (route.request().resourceType() === "document") headers["content-security-policy"] = csp;
    await route.fulfill({ status: r.status(), headers, body: await r.body() });
  });
}
await playHost("history-globe-git-main-arvavit.vercel.app");
await playHost("copy.example");

const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__cspv = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.__cspv.push(`${e.violatedDirective} ${e.blockedURI}`),
  );
});
const violations = () => page.evaluate(() => window.__cspv);
const original = () => page.getByRole("link", { name: "Original: historyglobe.app" });
const trap = () => page.locator('a[href$="export/"]');

async function silent(url) {
  beacons.length = 0;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  expect(beacons.length === 0, `beacon sent from ${url}: ${beacons.join(" ")}`);
  expect((await original().count()) === 0, `the original's line shown on ${url}`);
}

await step("robots.txt disallows /export/ for everyone, the sitemap does not list it", async () => {
  const robots = await (await ctx.request.get(`${BASE}robots.txt`)).text();
  const everyone = robots.slice(robots.indexOf("User-agent: *"));
  expect(/^Disallow: \/export\/$/m.test(everyone), "no Disallow: /export/ under User-agent: *");
  const sitemap = await ctx.request.get(`${BASE}sitemap.xml`);
  if (sitemap.status() === 200)
    expect(!(await sitemap.text()).includes("/export/"), "sitemap lists /export/");
  const trapPage = await ctx.request.get(`${BASE}export/`);
  expect(trapPage.status() === 200, `/export/ answers ${trapPage.status()}`);
  expect(
    (await trapPage.text()).includes('content="noindex, nofollow"'),
    "/export/ without noindex",
  );
});

for (const path of ["", "en/places/", "docs/privacy.html", "docs/ru/privacy.html"]) {
  await step(`on the site, /${path}: no beacon, no line, the honeypot's link unseen`, async () => {
    await silent(BASE + path);
    expect((await trap().count()) === 1, "the honeypot's link is not in the page");
    expect(!(await trap().isVisible()), "the honeypot's link is visible");
    expect((await page.getByRole("link", { name: "Export" }).count()) === 0, "the link has a role");
    const attrs = await trap().evaluate((a) => [
      a.rel,
      a.getAttribute("aria-hidden"),
      a.tabIndex,
      a.hidden,
    ]);
    expect(
      JSON.stringify(attrs) === '["nofollow","true",-1,true]',
      `attributes ${JSON.stringify(attrs)}`,
    );
    // Tab from the start of the page never lands on it.
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("href"));
    expect(!(focused ?? "").endsWith("export/"), "Tab reaches the honeypot's link");
  });
}

await step("embedded (?embed=1 and /embed/v1/): no beacon, no line", async () => {
  await silent(`${BASE}?embed=1`);
  await silent(`${BASE}embed/v1/`);
});

await step("a preview of the project: no beacon, no line", async () => {
  await silent("https://history-globe-git-main-arvavit.vercel.app/");
  expect((await violations()).length === 0, `CSP: ${(await violations()).join(", ")}`);
});

for (const path of ["", "en/places/"]) {
  await step(
    `a copy on another host, /${path}: the beacon names the host, the line names the original`,
    async () => {
      beacons.length = 0;
      await page.goto(`https://copy.example/${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.querySelector('a[href="https://historyglobe.app/"]'),
        null,
        {
          timeout: 10_000,
        },
      );
      await page.waitForTimeout(500);
      expect(beacons.includes("/origin/copy.example"), `beacons: ${beacons.join(" ") || "none"}`);
      expect(beacons.length === 1, `${beacons.length} beacons`);
      expect(await original().isVisible(), "the original's line is not shown");
      expect((await violations()).length === 0, `CSP: ${(await violations()).join(", ")}`);
    },
  );
}

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
