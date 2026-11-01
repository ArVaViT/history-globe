import { describe, expect, it } from "vitest";
import { rulersOf, type RulerPolity } from "./rulers.ts";

const square = (x0: number, y0: number, x1: number, y1: number) => ({
  type: "Polygon",
  coordinates: [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ],
  ],
});
const state = (
  name: string,
  y0: number,
  y1: number,
  box: [number, number, number, number],
  extra: Record<string, unknown> = {},
): RulerPolity => ({ geometry: square(...box), properties: { name, y0, y1, ...extra } });
const at = (id: string, x: number, y: number) => ({
  geometry: { coordinates: [x, y] },
  properties: { id },
});

describe("rulersOf", () => {
  it("names the smallest state where several hold the place", () => {
    const { states, rulers } = rulersOf(
      [state("Assyria", -900, -600, [0, 0, 10, 10]), state("Judah", -900, -586, [4, 4, 6, 6])],
      [at("jerusalem", 5, 5)],
    );
    const runs = rulers["jerusalem"] ?? [];
    expect(runs.map(([a, b, i]) => [a, b, states[i]?.n])).toEqual([[-900, -586, "Judah"]]);
  });

  it("joins the runs of one state and keeps the gaps", () => {
    const { states, rulers } = rulersOf(
      [
        state("Egypt", -1500, -1300, [0, 0, 10, 10]),
        state("Egypt", -1300, -1150, [0, 0, 10, 10]),
        state("Philistia", -1100, -700, [0, 0, 10, 10]),
      ],
      [at("ekron", 5, 5)],
    );
    expect((rulers["ekron"] ?? []).map(([a, b, i]) => [a, b, states[i]?.n])).toEqual([
      [-1500, -1150, "Egypt"],
      [-1100, -700, "Philistia"],
    ]);
  });

  it("leaves alliances out and keeps a state's names", () => {
    const { states, rulers } = rulersOf(
      [
        state("Alliance", -1300, -1200, [0, 0, 1, 1], { rel: true }),
        state("Elam", -1300, -1200, [0, 0, 10, 10], { name_ru: "Элам", c: 3 }),
      ],
      [at("susa", 0.5, 0.5), at("nowhere", 20, 20)],
    );
    expect(states).toEqual([{ n: "Elam", c: 3, names: { ru: "Элам" } }]);
    expect(rulers["susa"]).toEqual([[-1300, -1200, 0]]);
    expect(rulers["nowhere"]).toBeUndefined();
  });
});
