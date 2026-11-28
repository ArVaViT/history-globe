import { describe, expect, it } from "vitest";
import { frameOf, type MapLayers, routeMap } from "./route-map.ts";

const antioch = [36.16, 36.2] as const;
const seleucia = [35.93, 36.12] as const;
const salamis = [33.9, 35.18] as const;

describe("route map", () => {
  it("frames the stops inside the drawing", () => {
    const at = frameOf([antioch, salamis]);
    for (const p of [antioch, salamis]) {
      const [x, y] = at(p);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(800);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(500);
    }
    // North is up, east is right.
    expect(at(antioch)[0]).toBeGreaterThan(at(salamis)[0]);
    expect(at(antioch)[1]).toBeLessThan(at(salamis)[1]);
  });

  it("draws the way, dashed at sea, and one marker for a place stopped at twice", () => {
    const map = routeMap({
      stops: [
        { at: antioch, id: "antioch" },
        { at: seleucia, id: "seleucia" },
        { at: salamis, id: "salamis", by: "sea" },
        { at: antioch, id: "antioch", by: "sea" },
      ],
      year: 47,
      walked: true,
    });
    // A drawing of its own, with no words: one file for every language.
    expect(map?.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(map?.svg).toContain("prefers-color-scheme:dark");
    expect(map?.svg).toContain('class="f"');
    expect(map?.svg).toContain('class="e"');
    expect(map?.svg).toContain(">1,4</text>");
    expect(map?.svg).not.toContain(">4</text>");
    expect(map?.kinds).toEqual({ foot: true, sea: true, untold: false });
  });

  it("draws a voyage through its points at sea, and the dotted way untold apart", () => {
    const map = routeMap({
      stops: [
        { at: antioch, id: "a" },
        { at: salamis, id: "b", by: "sea", via: [[35.5, 35.6]] },
        { at: seleucia, id: "c", by: "untold" },
      ],
      year: 47,
      walked: true,
    });
    const sea = /<path class="e" d="([^"]+)"/.exec(map?.svg ?? "")?.[1] ?? "";
    // From the stop, through the point at sea, to the next stop: three points.
    expect(sea.split("L")).toHaveLength(3);
    expect(map?.svg).toContain('class="u"');
    expect(map?.kinds).toEqual({ foot: false, sea: true, untold: true });
  });

  it("keeps two places at one spot apart, the second moved aside with a line to its dot", () => {
    // Cherith and Abel-meholah, a few hundred metres apart on a map of the whole way.
    const map = routeMap({
      stops: [
        { at: [35.55, 32.35], id: "cherith" },
        { at: [35.2, 33.3], id: "zarephath" },
        { at: [35.551, 32.351], id: "abel-meholah" },
      ],
      year: -860,
      walked: true,
    });
    expect(map?.svg).toContain(">1</text>");
    expect(map?.svg).toContain(">3</text>");
    expect(map?.svg).not.toContain(">1,3</text>");
    expect(map?.svg).toContain('class="k"');
  });

  it("draws no way for stops that are not a way travelled", () => {
    const map = routeMap({
      stops: [{ at: antioch }, { at: salamis }],
      year: 47,
      walked: false,
    });
    expect(map?.svg).not.toContain("tm-way");
  });

  it("shows the states of the year only, cut to the frame, and names the large ones", () => {
    const square = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ];
    const layers: MapLayers = {
      water: [],
      polities: [
        { polygons: [[square(20, 30, 50, 45)]], y0: 40, y1: 60, c: 3, names: { name: "Rome" } },
        { polygons: [[square(20, 30, 50, 45)]], y0: 60, y1: 80, c: 1, names: { name: "Later" } },
      ],
    };
    const map = routeMap({
      stops: [{ at: antioch }, { at: salamis }],
      year: 47,
      walked: true,
      layers,
    });
    expect(map?.states).toEqual([{ name: "Rome" }]);
    expect(map?.svg).toContain("s c3");
    expect(map?.svg).not.toContain("s c1");
    // Cut to the frame: no coordinate far outside it.
    const nums = [...(map?.svg.matchAll(/[ML](-?\d+) (-?\d+)/g) ?? [])].map((m) => Number(m[1]));
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(-4);
    expect(Math.max(...nums)).toBeLessThanOrEqual(804);
  });

  it("draws nothing without a stop", () => {
    expect(routeMap({ stops: [], year: 0, walked: true })).toBeNull();
  });

  it("names every state a stop lies in, however small, in the stop's own year", () => {
    const square = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ];
    const layers: MapLayers = {
      water: [],
      polities: [
        // Large, around everything.
        { polygons: [[square(20, 25, 50, 45)]], y0: -900, y1: -500, c: 1, names: { name: "Big" } },
        // A speck around one stop: under the share that names a state, but a stop is in it.
        {
          polygons: [[square(35.1, 33.2, 35.3, 33.4)]],
          y0: -900,
          y1: -500,
          c: 2,
          names: { name: "Speck" },
        },
        // Around the other stop, only in that stop's own (later) year.
        {
          polygons: [[square(35.4, 32.2, 35.7, 32.5)]],
          y0: -600,
          y1: -500,
          c: 3,
          names: { name: "Later" },
        },
      ],
    };
    const map = routeMap({
      stops: [
        { at: [35.2, 33.3], id: "a" },
        { at: [35.55, 32.35], id: "b", year: -550 },
      ],
      year: -860,
      walked: true,
      layers,
    });
    expect(map?.states.map((s) => s.name)).toEqual(["Big", "Speck", "Later"]);
    expect(map?.touched).toBe(3);
    // The map itself shows the tour's year: the later state is named, not drawn.
    expect(map?.svg).not.toContain("s c3");
  });
});
