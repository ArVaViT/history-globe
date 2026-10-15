/**
 * The tours' route pictures (1200×630, no words, so one serves every language): land and
 * lakes from Natural Earth (public domain, pipeline/.cache from `pnpm data`), the way and
 * the stops' numbers; legs sailed are dashed. Written to apps/web/public/og/tour/<id>.jpg:
 * each tour page shows its picture and gives it to link previews (build-pages.ts).
 * Run after a tour's stops change, with Playwright found as the browser checks find it:
 *
 *   PLAYWRIGHT=~/some/project pnpm tour-images [id,id…]
 */
import { mkdirSync, readFileSync } from "node:fs";
import { launch } from "../e2e/browser.mjs";

const W = 1200;
const H = 630;
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const content = read("apps/web/public/data/content.json");
const places = new Map(
  read("apps/web/public/data/places.geojson").features.map((f) => [
    f.properties.id,
    f.geometry.coordinates,
  ]),
);
const land = read("pipeline/.cache/ne_50m_land.geojson").features;
const lakes = read("pipeline/.cache/ne_50m_lakes.geojson").features;
const out = "apps/web/public/og/tour";
mkdirSync(out, { recursive: true });
const only = process.argv[2]?.split(",");

/** The tour's way on an equirectangular plane (longitude scaled at its middle latitude). */
function svgFor(tour) {
  // The stops with a point, each kept with its own stop (its leg sailed or not).
  const known = tour.stops.filter((s) => places.has(s.place));
  const pts = known.map((s) => places.get(s.place));
  if (pts.length === 0) return null;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [
    Math.min(...lons),
    Math.max(...lons),
    Math.min(...lats),
    Math.max(...lats),
  ];
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  // No closer than about 1.2° across: a walk in Jerusalem does not shrink to one blot.
  // Margins of 18% on every side, and the frame's proportions.
  let spanY = Math.max(y1 - y0, 1.2) * 1.36;
  let spanX = Math.max((x1 - x0) * k, 1.44) * 1.36;
  if (spanX / spanY < W / H) spanX = (spanY * W) / H;
  else spanY = (spanX * H) / W;
  const cx = ((x0 + x1) / 2) * k;
  const cy = (y0 + y1) / 2;
  const px = (lon, lat) => [((lon * k - cx) / spanX) * W + W / 2, ((cy - lat) / spanY) * H + H / 2];
  const f1 = (v) => v.toFixed(1);
  const ring = (r) => `M${r.map(([lo, la]) => px(lo, la).map(f1).join(" ")).join("L")}Z`;
  const near = (r) =>
    r.some(([lo, la]) => {
      const [x, y] = px(lo, la);
      return x > -W && x < 2 * W && y > -H && y < 2 * H;
    });
  const polys = (fs) =>
    fs
      .flatMap((f) =>
        f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
      )
      .filter((p) => near(p[0]))
      .map((p) => p.map(ring).join(""))
      .join("");
  const xy = pts.map((p) => px(p[0], p[1]));
  // A tour that is not a journey (its stops a theme) has no way to draw.
  const legs =
    tour.walked === false
      ? []
      : xy.slice(1).map((p, i) => ({
          d: `M${f1(xy[i][0])} ${f1(xy[i][1])}L${f1(p[0])} ${f1(p[1])}`,
          sea: Boolean(known[i + 1]?.by),
        }));
  // A place come back to is one disc, with its first number.
  const seen = new Map();
  xy.forEach((p, i) => {
    const key = p.map((v) => v.toFixed(0)).join(",");
    if (!seen.has(key)) seen.set(key, { p, n: i + 1 });
  });
  const stops = [...seen.values()];
  const r = stops.length > 25 ? 9 : 13;
  const halo = legs.map(
    (l) =>
      `<path d="${l.d}" stroke="#fffaf0" stroke-width="9" stroke-linecap="round" fill="none" opacity="0.85"/>`,
  );
  const way = legs.map(
    (l) =>
      `<path d="${l.d}" stroke="#a63d2a" stroke-width="4.5" stroke-linecap="round" fill="none"${l.sea ? ' stroke-dasharray="10 8"' : ""}/>`,
  );
  const discs = stops.map(
    ({ p, n }) =>
      `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="#a63d2a" stroke="#fffaf0" stroke-width="3"/>` +
      (stops.length <= 40
        ? `<text x="${f1(p[0])}" y="${f1(p[1] + r * 0.36)}" font-family="Helvetica, Arial, sans-serif" font-size="${r * 1.05}" font-weight="700" fill="#fffaf0" text-anchor="middle">${n}</text>`
        : ""),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#cfdde3"/><path d="${polys(land)}" fill="#ece1cb" stroke="#b9a98a" stroke-width="1.2" fill-rule="evenodd"/><path d="${polys(lakes)}" fill="#cfdde3" stroke="#b9a98a" stroke-width="0.8"/>${halo.join("")}${way.join("")}${discs.join("")}</svg>`;
}

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
let n = 0;
for (const tour of content.tours) {
  if (only && !only.includes(tour.id)) continue;
  const svg = svgFor(tour);
  if (!svg) continue;
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: `${out}/${tour.id}.jpg`, type: "jpeg", quality: 80 });
  n++;
}
await browser.close();
console.log(`tour images: ${n}`);
