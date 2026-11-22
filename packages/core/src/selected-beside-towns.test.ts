/**
 * Every place of the built data, selected, is flown to close enough to stand apart from the
 * great town beside it (engine.ts selectedZoom), and the town stays in view. Golgotha, 460 m
 * from Jerusalem, was flown to at zoom 9.4: its ring lay on Jerusalem's, its name took the
 * town's place, and nothing on the map said where in Jerusalem it was.
 *
 * Every place is checked, as a host page (STEPBible) may select any of them.
 */
import { existsSync, readFileSync } from "node:fs";
import type { FeatureCollection, Point } from "geojson";
import { describe, expect, it } from "vitest";
import { selectedZoom, type PlaceInfo } from "./engine.ts";
import { POINT_ZOOM, zoomForKind } from "./kinds.ts";
import {
  BESIDE_MAX_ZOOM,
  BESIDE_PX,
  type GreatTown,
  isMajor,
  type Life,
  MIN_PX,
  outOfTime,
  pxApart,
} from "./majors.ts";

function read(name: string): unknown {
  const file = new URL(`../../../apps/web/public/data/${name}`, import.meta.url);
  if (!existsSync(file))
    throw new Error(
      `apps/web/public/data/${name} is not there: this test reads the data release; run \`pnpm data\` first (README.md, For developers). CI leaves it out.`,
    );
  return JSON.parse(readFileSync(file, "utf8"));
}
const places = read("places.geojson") as FeatureCollection<Point, Record<string, unknown>>;

interface Year {
  readonly year: number;
}
interface PlaceLife {
  readonly from?: Year;
  readonly until?: Year;
  readonly gap?: { readonly from: Year; readonly until: Year };
  readonly inherited?: boolean;
}
// When each place stood, as apps/web/src/data.ts reads it from the content.
const lives = (read("content.json") as { life: Record<string, PlaceLife> }).life;
function lifeOf(id: string, ot: unknown): Life {
  const l = lives[id];
  return {
    ...(typeof ot === "number" ? { ot } : {}),
    ...(l?.from ? { life_from: l.from.year } : {}),
    ...(l?.until ? { life_until: l.until.year + 1 } : {}),
    ...(l?.gap ? { gap_from: l.gap.from.year, gap_until: l.gap.until.year + 1 } : {}),
    ...(l && !l.inherited ? { life_own: true } : {}),
  };
}

// Every place is a point: a river is placed at one, its course is drawn from rivers.geojson.
const infos: PlaceInfo[] = places.features.map((f) => {
  const p = f.properties;
  const id = String(p["id"]);
  const great = isMajor(p) ? { great: lifeOf(id, p["ot"]) } : {};
  return {
    id,
    at: f.geometry.coordinates as [number, number],
    kind: String(p["kind"]),
    ...great,
  };
});
const towns: GreatTown[] = infos.flatMap((p) =>
  p.great ? [{ id: p.id, at: p.at, life: p.great }] : [],
);

/** The nearest great town standing in the year, in px at zoom 0. */
function nearest(p: PlaceInfo, year: number): { town: GreatTown; px: number } | null {
  let best: { town: GreatTown; px: number } | null = null;
  for (const t of towns) {
    if (t.id === p.id || outOfTime(t.life, year)) continue;
    const px = pxApart(p.at, t.at, 0);
    if (!best || px < best.px) best = { town: t, px };
  }
  return best;
}

const name = (id: string) =>
  String(places.features.find((f) => f.properties["id"] === id)?.properties["name"]);

interface Checked {
  /** On a great town and apart from it at the zoom flown to. */
  readonly apart: number;
  /** Ring on the town's ring: the place has the town's own point. */
  readonly shared: string[];
  /** Ring on the town's ring though some zoom would part them. */
  readonly onTop: string[];
  /** Flown so close the town falls out of a phone's view. */
  readonly lost: string[];
}

function check(year: number, zoomOf: (p: PlaceInfo) => number): Checked {
  let apart = 0;
  const shared: string[] = [];
  const onTop: string[] = [];
  const lost: string[] = [];
  for (const p of infos) {
    // Regions, seas and rivers are framed whole at their kind's zoom, often round a town's
    // point (Syria at Damascus): they are not set beside a town.
    if (zoomForKind(p.kind) < POINT_ZOOM) continue;
    // A great town is the setting itself; one beside it waits for its own room (thinMajors).
    if (p.great) continue;
    const near = nearest(p, year);
    if (!near) continue;
    const zoom = zoomOf(p);
    const px = near.px * 2 ** zoom;
    // Only a town within view matters: a phone's view is 390 px wide.
    if (px > 195) continue;
    const label = `${name(p.id)} (${p.id}) by ${name(near.town.id)}`;
    if (px >= MIN_PX) apart++;
    else if (near.px * 2 ** BESIDE_MAX_ZOOM < MIN_PX) shared.push(label);
    else onTop.push(label);
    if (zoom > zoomForKind(p.kind) && px > BESIDE_PX + 1) lost.push(label);
  }
  return { apart, shared, onTop, lost };
}

describe("a selected place stands apart from the great town beside it", () => {
  for (const year of [30, -1000]) {
    it(`in ${String(year)}`, () => {
      const r = check(year, (p) => selectedZoom(p, towns, year));
      expect(r.onTop).toEqual([]);
      expect(r.lost).toEqual([]);
      expect(r.apart).toBeGreaterThan(50);
      // The gates, halls and second names placed by the data at the town's own point: no
      // zoom parts them (majors.ts BESIDE_MAX_ZOOM), and the card says where they stood.
      expect(r.shared.length).toBeLessThan(120);
      for (const s of r.shared) expect(s).toMatch(/\(a[0-9a-f]{6}\) by /);
    });
  }

  it("was not so at the kind's zoom alone: Golgotha lay on Jerusalem", () => {
    const r = check(30, (p) => zoomForKind(p.kind));
    expect(r.onTop).toContain("Golgotha (a631d35) by Jerusalem");
    expect(r.onTop.length).toBeGreaterThan(20);
  });

  it("flies to Golgotha with Jerusalem in view, and leaves Capernaum and Galilee as they were", () => {
    const at = (id: string) => {
      const p = infos.find((x) => x.id === id);
      if (!p) throw new Error(id);
      return selectedZoom(p, towns, 30);
    };
    expect(at("a631d35")).toBeGreaterThan(13);
    expect(at("a631d35")).toBeLessThan(13.5);
    // Great towns themselves, and a region.
    expect(at("af2161c")).toBe(POINT_ZOOM);
    expect(at("a15257a")).toBe(POINT_ZOOM);
    expect(at("a9cf1e8")).toBe(zoomForKind("region"));
    // Mount Sinai, far from any town.
    expect(at("abfba2a")).toBe(POINT_ZOOM);
  });
});
