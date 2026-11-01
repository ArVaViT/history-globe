/**
 * Who ruled each place, century by century, for the card's band (data/rulers.json): the
 * states whose shape holds its point, the smallest where several overlap (Judah inside the
 * Assyrian world), alliances ("rel") left out. Runs of the same state are joined.
 */

type Ring = [number, number][];
type Geometry = { type: string; coordinates: unknown };
export type RulerPolity = {
  geometry: unknown;
  properties: { name: string; y0: number; y1: number; rel?: boolean } & Record<string, unknown>;
};
export type RulerPlace = { geometry: { coordinates: unknown }; properties: unknown };
export type RulerState = { n: string; c: number; names: Record<string, string> };
/** [from, to) years and the index of the state in `states`. */
export type Run = [number, number, number];

/** Ray casting: the point inside the ring. */
function pointIn([x, y]: [number, number], ring: Ring): boolean {
  let isIn = false;
  for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
    const [xk, yk] = ring[k] ?? [0, 0];
    const [xm, ym] = ring[m] ?? [0, 0];
    if (yk > y !== ym > y && x < ((xm - xk) * (y - yk)) / (ym - yk) + xk) isIn = !isIn;
  }
  return isIn;
}

type Shape = { box: [number, number, number, number]; polys: Ring[][]; area: number };

function shapeOf(g: Geometry): Shape {
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let area = 0;
  for (const poly of polys) {
    const ring = poly[0] ?? [];
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const [xk, yk] = ring[k] ?? [0, 0];
      const [xm, ym] = ring[m] ?? [0, 0];
      x0 = Math.min(x0, xk);
      y0 = Math.min(y0, yk);
      x1 = Math.max(x1, xk);
      y1 = Math.max(y1, yk);
      area += (xm - xk) * (ym + yk);
    }
  }
  return { box: [x0, y0, x1, y1], polys, area: Math.abs(area / 2) };
}

export function rulersOf(
  polities: readonly RulerPolity[],
  places: readonly RulerPlace[],
): { states: RulerState[]; rulers: Record<string, Run[]> } {
  const states: RulerState[] = [];
  const stateIndex = new Map<string, number>();
  const ruling = polities
    .filter((f) => !f.properties.rel)
    .map((f) => ({
      p: f.properties,
      s: shapeOf(f.geometry as Geometry),
    }));
  const rulers: Record<string, Run[]> = {};
  for (const f of places) {
    const [x, y] = f.geometry.coordinates as [number, number];
    const over = ruling.filter(
      ({ s }) =>
        x >= s.box[0] &&
        x <= s.box[2] &&
        y >= s.box[1] &&
        y <= s.box[3] &&
        s.polys.some(
          (poly) =>
            pointIn([x, y], poly[0] ?? []) && !poly.slice(1).some((h) => pointIn([x, y], h)),
        ),
    );
    if (over.length === 0) continue;
    const cuts = [...new Set(over.flatMap(({ p }) => [p.y0, p.y1]))].sort((a, b) => a - b);
    const runs: Run[] = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k] ?? 0;
      const b = cuts[k + 1] ?? 0;
      const here = over
        .filter(({ p }) => p.y0 <= a && b <= p.y1)
        .sort((u, v) => u.s.area - v.s.area)[0];
      if (!here) continue;
      const name = here.p.name;
      let i = stateIndex.get(name);
      if (i === undefined) {
        const names: Record<string, string> = {};
        for (const [key, value] of Object.entries(here.p))
          if (key.startsWith("name_") && typeof value === "string") names[key.slice(5)] = value;
        i = states.push({ n: name, c: Number(here.p["c"] ?? 0), names }) - 1;
        stateIndex.set(name, i);
      }
      const last = runs.at(-1);
      if (last && last[2] === i && last[1] === a) last[1] = b;
      else runs.push([a, b, i]);
    }
    rulers[(f.properties as { id: string }).id] = runs;
  }
  return { states, rulers };
}
