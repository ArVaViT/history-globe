import { expression } from "@maplibre/maplibre-gl-style-spec";
import fc from "fast-check";
import type { Feature, FeatureCollection, Point } from "geojson";
import { describe, expect, it } from "vitest";
import { LAST_ZOOM, MIN_PX, outOfTime, pxApart, thinMajors } from "./majors.ts";
import { OUT_OF_TIME } from "./style-expressions.ts";

let n = 0;
const town = (
  name: string,
  lon: number,
  lat: number,
  props: Record<string, unknown> = {},
): Feature<Point> => ({
  type: "Feature",
  id: ++n,
  properties: { id: `a${String(n)}`, name, kind: "settlement", rank: 0, ot: 5, ...props },
  geometry: { type: "Point", coordinates: [lon, lat] },
});

// The Levant's great towns at their OpenBible points, with their verse counts.
const tyre = town("Tyre", 35.19611, 33.27083, { verses: 64 });
const damascus = town("Damascus", 36.30639, 33.51111, { verses: 58 });
const jerusalem = town("Jerusalem", 35.2345, 31.7767, { verses: 955 });
const bethel = town("Bethel", 35.2214, 31.9304, { verses: 69 });
const hebron = town("Hebron", 35.0998, 31.5326, { verses: 62 });
const zion = town("Zion", 35.2345, 31.7767, { verses: 148, where_tpl: "same" });
const capernaum = town("Capernaum", 35.5751, 32.8803, { verses: 18, ot: 0 });
const levant: FeatureCollection = {
  type: "FeatureCollection",
  features: [tyre, damascus, jerusalem, bethel, hebron, zion, capernaum],
};

const keptAt = (fc: FeatureCollection<Point>, name: string) => {
  const f = fc.features.find((x) => x.properties?.["name"] === name);
  if (!f) return null;
  const keep = Number(f.properties?.["keep"]);
  return Array.from({ length: LAST_ZOOM + 1 }, (_, z) => z).filter((z) => (keep >> z) & 1);
};

describe("the great towns kept at each zoom", () => {
  it("keeps Damascus beside Tyre and Jerusalem from zoom 4, as the owner saw it go (8.10.2026)", () => {
    const majors = thinMajors(levant, -1000, null);
    // Kept at every zoom a great town is drawn at (from 3): at 3 Tyre, 13 px from it, gives
    // way to Jerusalem's ring, 20 px from Tyre, and leaves Damascus its room.
    expect(pxApart(tyre.geometry.coordinates, damascus.geometry.coordinates, 3)).toBeLessThan(
      MIN_PX,
    );
    for (let z = 3; z <= LAST_ZOOM; z++) {
      expect(keptAt(majors, "Damascus")).toContain(z);
      expect(keptAt(majors, "Jerusalem")).toContain(z);
    }
    expect(keptAt(majors, "Tyre")).not.toContain(3);
    for (let z = 4; z <= LAST_ZOOM; z++) expect(keptAt(majors, "Tyre")).toContain(z);
  });

  it("keeps the most named first: Bethel and Hebron wait till Jerusalem's ring leaves them room", () => {
    const majors = thinMajors(levant, -1000, null);
    expect(keptAt(majors, "Jerusalem")).toEqual(Array.from({ length: LAST_ZOOM + 1 }, (_, z) => z));
    for (const f of [bethel, hebron]) {
      const from = keptAt(majors, String(f.properties?.["name"]))?.[0] ?? 99;
      expect(
        pxApart(jerusalem.geometry.coordinates, f.geometry.coordinates, from),
      ).toBeGreaterThanOrEqual(MIN_PX);
      expect(
        pxApart(jerusalem.geometry.coordinates, f.geometry.coordinates, from - 1),
      ).toBeLessThan(MIN_PX);
    }
  });

  it("never keeps two rings closer than MIN_PX below the last zoom, and keeps all at it", () => {
    const majors = thinMajors(levant, -1000, null);
    for (let z = 0; z < LAST_ZOOM; z++) {
      const kept = majors.features.filter((f) => (Number(f.properties?.["keep"]) >> z) & 1);
      for (const a of kept)
        for (const b of kept)
          if (a !== b)
            expect(
              pxApart(a.geometry.coordinates, b.geometry.coordinates, z),
            ).toBeGreaterThanOrEqual(MIN_PX);
    }
    for (const f of majors.features)
      expect((Number(f.properties?.["keep"]) >> LAST_ZOOM) & 1).toBe(1);
  });

  it("leaves out a second name on a point and a town not standing in the year", () => {
    const names = (year: number): string[] =>
      thinMajors(levant, year, null).features.map((f) => String(f.properties?.["name"]));
    expect(names(-1000)).not.toContain("Zion");
    expect(names(-1000)).not.toContain("Capernaum");
    expect(names(30)).toContain("Capernaum");
  });

  it("gives the selected place's room first, and leaves it to the picked layer", () => {
    const majors = thinMajors(levant, -1000, String(bethel.properties?.["id"]));
    expect(keptAt(majors, "Bethel")).toBeNull();
    // Bethel's gold dot, 17 km from Jerusalem, keeps Jerusalem's ring off at zoom 5.
    expect(keptAt(majors, "Jerusalem")).not.toContain(5);
  });

  it("reads the years as the style does (OUT_OF_TIME)", () => {
    const compiled = (year: number) => {
      const c = expression.createExpression(OUT_OF_TIME, "filter", null, { year });
      if (c.result !== "success") throw new Error("OUT_OF_TIME does not compile");
      return c.value;
    };
    const opt = <T>(arb: fc.Arbitrary<T>) => fc.option(arb, { nil: undefined });
    const year = fc.integer({ min: -4000, max: 2000 });
    fc.assert(
      fc.property(
        year,
        fc.record({
          gap_from: opt(year),
          gap_until: opt(year),
          life_from: opt(year),
          life_until: opt(year),
          life_own: opt(fc.constant(true)),
          ot: opt(fc.integer({ min: 0, max: 3 })),
        }),
        (y, raw) => {
          const props = Object.fromEntries(
            Object.entries(raw).filter(([, v]) => v !== undefined),
          ) as Parameters<typeof outOfTime>[0];
          const style = compiled(y).evaluate({ zoom: 8 }, {
            type: 1,
            properties: props,
            geometry: [],
          } as never) as boolean;
          expect(outOfTime(props, y)).toBe(style);
        },
      ),
      { numRuns: 400 },
    );
  });
});
