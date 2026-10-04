/**
 * The states for the map (Cliopatria, ADR 0004) with our corrections
 * (content/polity-overrides.yaml): shapes copied forward and back, clipped, recoloured,
 * renamed, cut out of years, bridged, annexed, made vassals; one lead label each; the
 * small states' labels moved into the open; Russian names (content/polity-names.yaml).
 * Read from the pipeline's files and written back through `writes`, idempotently: a rerun
 * gives the same files. Part of scripts/build-content.ts, which calls it.
 */
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { PolityNamesFile, PolityOverridesFile } from "../packages/model/src/content.ts";
import { POLITY_SPLIT_YEAR } from "../packages/model/src/time.ts";

export interface PolityBuild {
  readonly out: string;
  readonly load: (path: string) => unknown;
  readonly places: {
    features: {
      geometry: { coordinates: number[] };
      properties: { rank: number };
    }[];
  };
  readonly errors: string[];
  readonly writes: [path: string, text: string][];
}

export function buildPolities({ out, load, places, errors, writes }: PolityBuild): void {
  // Our corrections to Cliopatria (content/polity-overrides.yaml): a polity's last shape and
  // labels are copied forward to its real end. Idempotent: earlier copies are dropped first.
  type PolityFeature = {
    geometry: unknown;
    properties: {
      name: string;
      y0: number;
      y1: number;
      rel?: boolean;
      src?: string;
      /** Cliopatria's own years of a shape an override cut short, restored on a rerun. */
      cut?: [number, number];
      /** A copy clipped for some years only (overrides \`clips\` with years). */
      clipped?: number;
    };
  };
  /** Ray casting: the point inside the ring. */
  const pointIn = ([x, y]: [number, number], ring: [number, number][]) => {
    let isIn = false;
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const [xk, yk] = ring[k] ?? [0, 0];
      const [xm, ym] = ring[m] ?? [0, 0];
      if (yk > y !== ym > y && x < ((xm - xk) * (y - yk)) / (ym - yk) + xk) isIn = !isIn;
    }
    return isIn;
  };
  /** A vassal's marks: the overlord's colour in `c`, its own kept in `vc`, the second line. */
  type VassalProps = { c?: number; vc?: number; v?: string; v_ru?: string };
  // The polities ship twice (below): what the first frame needs, to AD 500, and all of them,
  // which the map switches to when the slider first passes AD 500. The later half is also
  // kept apart, so that a rerun reads the whole set back from the two halves.
  const POLITY_SPLIT = POLITY_SPLIT_YEAR;
  const polityPath = join(out, "polities.geojson");
  const polityLatePath = join(out, "polities-late.geojson");
  const labelsLatePath = join(out, "polity-labels-late.geojson");
  const readFeatures = (path: string): PolityFeature[] =>
    existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as { features: PolityFeature[] }).features
      : [];
  const polities = { features: [...readFeatures(polityPath), ...readFeatures(polityLatePath)] };
  const polityLabels = {
    features: [
      ...readFeatures(join(out, "polity-labels.geojson")),
      ...readFeatures(labelsLatePath),
    ],
  };
  polities.features = polities.features.filter((f) => f.properties.src !== "override");
  polityLabels.features = polityLabels.features.filter((f) => f.properties.src !== "override");
  const labelSet = new Set<unknown>(polityLabels.features);
  for (const f of [...polities.features, ...polityLabels.features]) {
    // A vassal's colour and second line (below) come off before anything is applied again.
    const p = f.properties as PolityFeature["properties"] & VassalProps;
    if (p.vc !== undefined) {
      p.c = p.vc;
      delete p.vc;
      delete p.v;
      delete p.v_ru;
      delete (p as { vin?: boolean }).vin;
    }
    // The pipeline's tier of a label, kept apart: the tiers are given again below, and a
    // clip that read the given ones decided differently on a rerun than on a first build.
    // Labels only (a shape has no tier); and the tier given back, as it is given again below.
    const lp = f.properties as { tier?: number; tier0?: number };
    if (labelSet.has(f)) {
      if (lp.tier0 === undefined) lp.tier0 = lp.tier ?? 0;
      else lp.tier = lp.tier0;
    } else delete lp.tier0;
    if (!f.properties.cut) continue;
    [f.properties.y0, f.properties.y1] = f.properties.cut;
    delete f.properties.cut;
  }
  const overridesFile = PolityOverridesFile.parse(load("content/polity-overrides.yaml"));
  for (const o of overridesFile.overrides) {
    const own = polities.features.filter(
      (f) => f.properties.name === o.polity && !f.properties.rel,
    );
    if (own.length === 0) {
      errors.push(`polity-overrides: "${o.polity}" is not in the data build`);
      continue;
    }
    const end = Math.max(...own.map((f) => f.properties.y1));
    const until = o.last_year + 1; // half-open, ADR 0003
    if (until === end) {
      errors.push(`polity-overrides: "${o.polity}" already lasts to ${String(end - 1)}`);
      continue;
    }
    // Ended sooner than Cliopatria has it: its later shapes and labels are cut at the end
    // (a shape wholly after it gets an empty span), keeping their years to restore.
    if (until < end) {
      for (const f of [...polities.features, ...polityLabels.features]) {
        if (f.properties.name !== o.polity || f.properties.y1 <= until) continue;
        f.properties.cut = [f.properties.y0, f.properties.y1];
        f.properties.y1 = Math.max(f.properties.y0, until);
        f.properties.y0 = Math.min(f.properties.y0, f.properties.y1);
      }
      continue;
    }
    const extend = (f: PolityFeature): PolityFeature => ({
      ...f,
      properties: { ...f.properties, y0: end, y1: until, src: "override" },
    });
    polities.features.push(...own.filter((f) => f.properties.y1 === end).map(extend));
    polityLabels.features.push(
      ...polityLabels.features
        .filter((f) => f.properties.name === o.polity && f.properties.y1 === end)
        .map(extend),
    );
  }

  // Polities drawn from earlier than Cliopatria has them (overrides `starts`): their first
  // shape and labels copied back to the year given. Marked as overrides, so a rebuild drops
  // the copies before making them again.
  for (const o of overridesFile.starts ?? []) {
    const own = polities.features.filter(
      (f) => f.properties.name === o.polity && !f.properties.rel,
    );
    if (own.length === 0) {
      errors.push(`polity-overrides: start "${o.polity}" is not in the data build`);
      continue;
    }
    const start = Math.min(...own.map((f) => f.properties.y0));
    if (o.first_year === start) {
      errors.push(`polity-overrides: "${o.polity}" already starts in ${String(start)}`);
      continue;
    }
    // Started later than Cliopatria has it: its earlier shapes and labels are cut at the
    // start (a shape wholly before it gets an empty span), keeping their years to restore.
    if (o.first_year > start) {
      for (const f of [...polities.features, ...polityLabels.features]) {
        if (f.properties.name !== o.polity || f.properties.y0 >= o.first_year) continue;
        f.properties.cut ??= [f.properties.y0, f.properties.y1];
        f.properties.y0 = Math.min(o.first_year, f.properties.y1);
      }
      continue;
    }
    const back = (f: PolityFeature): PolityFeature => ({
      ...f,
      properties: { ...f.properties, y0: o.first_year, y1: start, src: "override" },
    });
    polities.features.push(...own.filter((f) => f.properties.y0 === start).map(back));
    polityLabels.features.push(
      ...polityLabels.features
        .filter((f) => f.properties.name === o.polity && f.properties.y0 === start)
        .map(back),
    );
  }

  // Shapes cut to where the polity was (overrides `clips`): each ring is clipped to a convex
  // polygon (Sutherland-Hodgman), a label outside it moves to the middle of what is left.
  // Clipping a clipped shape changes nothing, so a rebuild gives the same files.
  type Ring = [number, number][];
  const clipRing = (ring: Ring, clip: Ring): Ring => {
    // Inside = left of each clip edge for a counter-clockwise clip polygon.
    const ccw =
      clip.reduce((a, [x1, y1], i) => {
        const [x2, y2] = clip[(i + 1) % clip.length] ?? [0, 0];
        return a + (x2 - x1) * (y2 + y1);
      }, 0) < 0;
    const edges = ccw ? clip : [...clip].reverse();
    let out: Ring = ring;
    for (let i = 0; i < edges.length && out.length > 0; i++) {
      const [ax, ay] = edges[i] ?? [0, 0];
      const [bx, by] = edges[(i + 1) % edges.length] ?? [0, 0];
      // Within 0.002° of the edge counts as inside: the points written at three decimals
      // fall just outside it, and a rebuild must leave a clipped shape as it is.
      const len = Math.hypot(bx - ax, by - ay);
      const inside = ([x, y]: [number, number]) =>
        (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -0.002 * len;
      const cross = ([px, py]: [number, number], [qx, qy]: [number, number]): [number, number] => {
        const a1 = by - ay;
        const b1 = ax - bx;
        const c1 = a1 * ax + b1 * ay;
        const a2 = qy - py;
        const b2 = px - qx;
        const c2 = a2 * px + b2 * py;
        const det = a1 * b2 - a2 * b1;
        return det === 0 ? [px, py] : [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
      };
      const input = out;
      out = [];
      for (let j = 0; j < input.length; j++) {
        const cur = input[j] ?? [0, 0];
        const prev = input[(j + input.length - 1) % input.length] ?? [0, 0];
        if (inside(cur)) {
          if (!inside(prev)) out.push(cross(prev, cur));
          out.push(cur);
        } else if (inside(prev)) out.push(cross(prev, cur));
      }
    }
    return out;
  };
  // Clips for all years first: they cut the shapes themselves, and a clip for some years
  // copies the shapes; copied before the cut on a first build and after it on a rerun, the
  // copies differed. `k` stays the clip's place in the file.
  const clipsInOrder = [...(overridesFile.clips ?? []).entries()].sort(
    ([, x], [, y]) =>
      Number(x.first_year !== undefined || x.last_year !== undefined) -
      Number(y.first_year !== undefined || y.last_year !== undefined),
  );
  for (const [k, c] of clipsInOrder) {
    const clip = c.within;
    // A clip for some years only: the shapes and labels standing in them are copied for
    // those years (overrides, made again on every build) and only the copies are clipped;
    // the originals keep their geometry and give up those years (restored on a rerun).
    const a = c.first_year ?? -Infinity;
    const b = c.last_year === undefined ? Infinity : c.last_year + 1;
    const limited = Number.isFinite(a) || Number.isFinite(b);
    if (limited)
      for (const list of [polities.features, polityLabels.features])
        for (const f of list.filter(
          // Any shape of the polity standing in those years, a copy made by another
          // correction too (an extension, the years after another clip), but not one another
          // clip has already cut: each clip cuts only its own copies.
          (g) =>
            g.properties.name === c.polity &&
            g.properties.clipped === undefined &&
            g.properties.y0 < b &&
            a < g.properties.y1,
        )) {
          const p = f.properties;
          const { y0, y1 } = p;
          list.push({
            ...f,
            geometry: JSON.parse(JSON.stringify(f.geometry)) as unknown,
            properties: {
              ...p,
              y0: Math.max(y0, a),
              y1: Math.min(y1, b),
              src: "override",
              clipped: k,
            },
          });
          // Its own geometry: a label moved later must not move the original with it.
          if (b < y1)
            list.push({
              ...f,
              geometry: JSON.parse(JSON.stringify(f.geometry)) as unknown,
              properties: { ...p, y0: b, y1, src: "override" },
            });
          if (p.src !== "override") p.cut ??= [y0, y1];
          p.y1 = Math.max(y0, Math.min(y1, a));
        }
    const shapes = polities.features.filter(
      (f) => f.properties.name === c.polity && (!limited || f.properties.clipped === k),
    );
    if (shapes.length === 0)
      errors.push(`polity-overrides: clip "${c.polity}" is not in the data build`);
    for (const f of shapes) {
      const g = f.geometry as { type: string; coordinates: Ring[] | Ring[][] };
      const polys = (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]) as Ring[][];
      const kept = polys
        .map((poly) => {
          // Open the ring, clip it, close it again.
          const outer = (poly[0] ?? []).slice(0, -1);
          const cut = clipRing(outer, clip);
          return cut.length >= 3 ? [[...cut, cut[0] ?? [0, 0]]] : null;
        })
        .filter((p): p is Ring[] => p !== null);
      f.geometry = { type: "MultiPolygon", coordinates: kept };
    }
    // Label size follows the area left, as pipeline/build_data.py sets it from the whole:
    // log10 of the shoelace area in square degrees, plus 2.
    const area = (ring: Ring) =>
      Math.abs(
        ring.reduce((a, [x0, y0], k) => {
          const [x1, y1] = ring[(k + 1) % ring.length] ?? [x0, y0];
          return a + x0 * y1 - x1 * y0;
        }, 0),
      ) / 2;
    // A label's own shape: of its years, and of its copy (another clip's years are another
    // copy, with another cut); the first that stands in its years otherwise.
    const ownShape = (f: (typeof polityLabels.features)[number]) => {
      const inYears = shapes.filter(
        (s) => s.properties.y0 <= f.properties.y0 && f.properties.y0 < s.properties.y1,
      );
      return inYears.find((s) => s.properties.clipped === f.properties.clipped) ?? inYears[0];
    };
    for (const f of polityLabels.features) {
      if (f.properties.name !== c.polity || (limited && f.properties.clipped !== k)) continue;
      const own = ownShape(f);
      const polys = (own?.geometry as { coordinates: Ring[][] } | undefined)?.coordinates ?? [];
      const total = polys.reduce((a, p) => a + area(p[0] ?? []), 0);
      (f.properties as { size?: number }).size =
        Math.round((Math.log10(Math.max(total, 0.01)) + 2) * 100) / 100;
    }
    // A label off the cut shape of its years moves to the middle of it (the mean of its
    // outer ring's points), if that lands inside: ray casting, as the shape may be concave.
    const inRing = ([x, y]: [number, number], ring: Ring) => {
      let inside = false;
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const [xk, yk] = ring[k] ?? [0, 0];
        const [xm, ym] = ring[m] ?? [0, 0];
        if (yk > y !== ym > y && x < ((xm - xk) * (y - yk)) / (ym - yk) + xk) inside = !inside;
      }
      return inside;
    };
    for (const f of polityLabels.features) {
      if (f.properties.name !== c.polity || (limited && f.properties.clipped !== k)) continue;
      const at = f.geometry as { coordinates: [number, number] };
      const rings = (
        (ownShape(f)?.geometry as { coordinates: Ring[][] } | undefined)?.coordinates ?? []
      )
        .map((p) => p[0] ?? [])
        .filter((r) => r.length >= 4);
      // Inside any of its pieces, it stays.
      if (rings.length === 0 || rings.some((r) => inRing(at.coordinates, r))) continue;
      // One of the grid of points an empire is named at up close (tier 1, 2): off the cut
      // shape it is not needed, and moved it would sit on the main one.
      const p = f.properties as { tier0?: number; cut?: [number, number] };
      if ((p.tier0 ?? 0) > 0) {
        if (f.properties.src !== "override") p.cut ??= [f.properties.y0, f.properties.y1];
        f.properties.y1 = f.properties.y0;
        continue;
      }
      // The main one goes to the middle of the largest piece.
      const ring = rings.reduce((a, r) => (area(r) > area(a) ? r : a));
      const pts = ring.slice(0, -1);
      const mid: [number, number] = [
        Math.round((pts.reduce((a, [x]) => a + x, 0) / pts.length) * 1000) / 1000,
        Math.round((pts.reduce((a, [, y]) => a + y, 0) / pts.length) * 1000) / 1000,
      ];
      if (inRing(mid, ring)) {
        at.coordinates = mid;
        continue;
      }
      // A concave piece whose mean falls outside: the middle of the widest stretch of it
      // along the mean's latitude.
      const xs = ring
        .slice(0, -1)
        .flatMap(([x0, y0], j) => {
          const [x1, y1] = ring[j + 1] ?? [x0, y0];
          return y0 > mid[1] !== y1 > mid[1] ? [x0 + ((mid[1] - y0) * (x1 - x0)) / (y1 - y0)] : [];
        })
        .sort((a, b) => a - b);
      let best: [number, number] | null = null;
      for (let j = 0; j + 1 < xs.length; j += 2) {
        const [x0 = 0, x1 = 0] = [xs[j], xs[j + 1]];
        if (!best || x1 - x0 > best[1] - best[0]) best = [x0, x1];
      }
      if (best) at.coordinates = [Math.round(((best[0] + best[1]) / 2) * 1000) / 1000, mid[1]];
    }
  }

  // Colours: the pipeline gives each polity the next of ten in turn, so neighbours that
  // stood in the same years often shared one (Judah and the Neo-Babylonian Empire, Egypt
  // and Assyria in two greens). Recoloured here as a map is: polities are neighbours when
  // they coexist and their borders come within a cell (1°) of each other; the largest are
  // coloured first, each with a colour whose family of hue (style.ts: two greens, two
  // browns, two violets) no coloured neighbour has, else a colour none has, else the least
  // used. Deterministic and independent of the colours read back, so a rerun gives the
  // same map: done after the clips, which cut some shapes in place (Assyria's without
  // years), so the first build after the pipeline sees the shapes a rerun reads back.
  {
    // POLITY_COLORS as they look laid thin on the land: the greens and the teal read as one
    // grey-green, the plum, the violet and the red as one pink (design sweep).
    const FAMILY = [0, 1, 1, 3, 4, 5, 3, 1, 0, 3];
    // Neighbours shape by shape: two states are neighbours only if shapes of theirs stand in
    // the same years within a cell (1°) of each other, not if one's border of some century
    // came near the other's of another.
    type Shape = { name: string; y0: number; y1: number; cells: Set<string> };
    const shapes: Shape[] = [];
    const size = new Map<string, number>();
    for (const f of polities.features) {
      if (f.properties.rel || f.properties.y1 <= f.properties.y0) continue;
      const sh: Shape = {
        name: f.properties.name,
        y0: f.properties.y0,
        y1: f.properties.y1,
        cells: new Set(),
      };
      const g = f.geometry as { type: string; coordinates: unknown };
      const polys = (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]) as [
        number,
        number,
      ][][][];
      for (const poly of polys)
        for (const [x, y] of poly[0] ?? []) {
          sh.cells.add(`${String(Math.floor(x))}:${String(Math.floor(y))}`);
          size.set(sh.name, (size.get(sh.name) ?? 0) + 1);
        }
      shapes.push(sh);
    }
    const byCell = new Map<string, number[]>();
    shapes.forEach((sh, k) => {
      for (const cell of sh.cells) {
        const list = byCell.get(cell) ?? [];
        list.push(k);
        byCell.set(cell, list);
      }
    });
    const neighbours = new Map<string, Set<string>>();
    shapes.forEach((sh) => {
      const near = neighbours.get(sh.name) ?? new Set<string>();
      neighbours.set(sh.name, near);
      for (const cell of sh.cells) {
        const [cx, cy] = cell.split(":").map(Number) as [number, number];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (const k of byCell.get(`${String(cx + dx)}:${String(cy + dy)}`) ?? []) {
              const other = shapes[k];
              if (other && other.name !== sh.name && sh.y0 < other.y1 && other.y0 < sh.y1)
                near.add(other.name);
            }
      }
    });
    const info = size;
    const order = [...info.keys()].sort(
      (a, b) => (info.get(b) ?? 0) - (info.get(a) ?? 0) || a.localeCompare(b),
    );
    const colour = new Map<string, number>();
    for (const name of order) {
      const used = [...(neighbours.get(name) ?? [])]
        .map((o) => colour.get(o))
        .filter((c): c is number => c !== undefined);
      const families = new Set(used.map((c) => FAMILY[c]));
      const all = [...FAMILY.keys()];
      const pick =
        all.find((c) => !families.has(FAMILY[c])) ??
        all.find((c) => !used.includes(c)) ??
        all.sort(
          (a, b) => used.filter((u) => u === a).length - used.filter((u) => u === b).length,
        )[0] ??
        0;
      colour.set(name, pick);
    }
    for (const f of [...polities.features, ...polityLabels.features]) {
      const c = colour.get(f.properties.name);
      if (c !== undefined) (f.properties as VassalProps).c = c;
    }
  }

  // A new name from a year on (overrides `renamed`): a shape running across the year is
  // split, the copy after it (an override) takes the new name; the original keeps its years
  // before (restored on a rerun). The colours were given before, so a renamed shape keeps
  // its land's colour; its label is placed and pinned as any other.
  for (const x of overridesFile.renamed ?? []) {
    const a = x.first_year.year;
    let hit = false;
    // Renamed to a polity already on the map (Egypt as Kush's), the shape takes its colour;
    // to a new name, it keeps its land's.
    const known = polities.features.find(
      (g) => g.properties.name === x.name && !g.properties.rel && g.properties.src !== "override",
    ) as { properties: { c?: number } } | undefined;
    const colour = known?.properties.c === undefined ? {} : { c: known.properties.c };
    for (const list of [polities.features, polityLabels.features]) {
      for (const f of list.filter((g) => g.properties.name === x.polity && g.properties.y1 > a)) {
        hit = true;
        const p = f.properties;
        if (p.y0 >= a) {
          if (p.src !== "override") p.cut ??= [p.y0, p.y1];
          list.push({ ...f, properties: { ...p, ...colour, name: x.name, src: "override" } });
          p.y1 = p.y0; // an empty span: the renamed copy draws these years
        } else {
          list.push({
            ...f,
            properties: { ...p, ...colour, name: x.name, y0: a, src: "override" },
          });
          if (p.src !== "override") p.cut ??= [p.y0, p.y1];
          p.y1 = a;
        }
      }
    }
    if (!hit) errors.push(`polity-overrides: renamed "${x.polity}" is not on the map from then`);
  }

  // Years a polity did not exist (overrides `absent`): its shapes and labels are cut out of
  // them; a shape running past the gap keeps its own years before it (restored on a rerun)
  // and a copy, marked as an override, takes the years after.
  for (const x of overridesFile.absent ?? []) {
    const a = x.first_year;
    const b = x.last_year + 1; // half-open, ADR 0003
    let hit = false;
    for (const list of [polities.features, polityLabels.features]) {
      for (const f of list.filter(
        (g) =>
          g.properties.name === x.polity &&
          !g.properties.rel &&
          g.properties.y0 < b &&
          a < g.properties.y1,
      )) {
        hit = true;
        const p = f.properties;
        const { y0, y1 } = p;
        if (b < y1) list.push({ ...f, properties: { ...p, y0: b, y1, src: "override" } });
        if (p.src !== "override") p.cut ??= [y0, y1];
        // Before the gap, or nothing (an empty span) when the shape starts inside it.
        p.y1 = Math.max(y0, Math.min(y1, a));
        p.y0 = Math.min(y0, p.y1);
      }
    }
    if (!hit)
      errors.push(`polity-overrides: absent "${x.polity}" is not on the map in those years`);
  }

  // Years the data leaves a polity off the map (overrides `bridges`): its shapes and labels
  // from just before are drawn on through them, as overrides.
  for (const x of overridesFile.bridges ?? []) {
    const a = x.first_year;
    const b = x.last_year + 1; // half-open, ADR 0003
    const own = polities.features.filter(
      (f) =>
        f.properties.name === x.polity &&
        !f.properties.rel &&
        f.properties.y1 <= a &&
        f.properties.y1 > f.properties.y0,
    );
    const end = Math.max(...own.map((f) => f.properties.y1));
    if (
      own.length === 0 ||
      polities.features.some(
        (f) =>
          f.properties.name === x.polity &&
          !f.properties.rel &&
          f.properties.y0 < b &&
          a < f.properties.y1 &&
          f.properties.y1 > f.properties.y0,
      )
    ) {
      errors.push(
        `polity-overrides: bridge "${x.polity}": nothing before, or already drawn in those years`,
      );
      continue;
    }
    const carry = (f: PolityFeature): PolityFeature => ({
      ...f,
      properties: { ...f.properties, y0: a, y1: b, src: "override" },
    });
    polities.features.push(...own.filter((f) => f.properties.y1 === end).map(carry));
    polityLabels.features.push(
      ...polityLabels.features
        .filter(
          (f) => f.properties.name === x.polity && f.properties.y1 === end && !f.properties.rel,
        )
        .map(carry),
    );
  }

  // Lands an empire took over (overrides `annexed`): the polity's last shape, drawn under
  // the empire's name and colour for those years; marked as an override, so a rerun drops
  // the copy before making it again.
  for (const x of overridesFile.annexed ?? []) {
    const a = x.first_year;
    const b = x.last_year + 1; // half-open, ADR 0003
    const last = polities.features
      .filter((f) => f.properties.name === x.polity && !f.properties.rel && f.properties.y1 <= a)
      .sort((f1, f2) => f2.properties.y1 - f1.properties.y1)[0];
    const by = polities.features.find(
      (f) =>
        f.properties.name === x.by &&
        !f.properties.rel &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    );
    if (!last || !by || b <= a) {
      errors.push(
        `polity-overrides: annexed "${x.polity}" by "${x.by}": nothing to draw in those years`,
      );
      continue;
    }
    polities.features.push({
      ...last,
      properties: { ...by.properties, y0: a, y1: b, src: "override" },
    });
  }

  // Vassals (overrides `vassals`): in the years a polity paid tribute to an empire or ruled
  // as its client, its shapes take the overlord's colour (drawn lighter, style.ts) and its
  // label a second line, "under Assyria". A shape that runs past those years is split: the
  // shape itself keeps the vassal years (its own restored on a rerun), copies marked as
  // overrides take the years before and after.
  for (const v of overridesFile.vassals ?? []) {
    const a = v.first_year.year;
    const b = v.last_year.year + 1; // half-open, ADR 0003
    const overlaps = (f: PolityFeature) =>
      f.properties.name === v.polity &&
      !f.properties.rel &&
      f.properties.y0 < b &&
      a < f.properties.y1;
    const lord = polities.features.find(
      (f) =>
        f.properties.name === v.of &&
        !f.properties.rel &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    ) as { properties: { c: number } } | undefined;
    if (!lord) {
      errors.push(
        `polity-overrides: vassal "${v.polity}": "${v.of}" is not on the map in those years`,
      );
      continue;
    }
    if (b <= a) {
      errors.push(`polity-overrides: vassal "${v.polity}" ends before it starts`);
      continue;
    }
    const own = [...polities.features, ...polityLabels.features].filter(overlaps);
    if (!own.some((f) => polities.features.includes(f))) {
      errors.push(`polity-overrides: vassal "${v.polity}" is not on the map in those years`);
      continue;
    }
    for (const list of [polities.features, polityLabels.features]) {
      for (const f of list.filter(overlaps)) {
        const p = f.properties as PolityFeature["properties"] & VassalProps;
        if (p.v !== undefined) {
          errors.push(`polity-overrides: vassal years of "${v.polity}" overlap`);
          continue;
        }
        const { y0, y1 } = p;
        const copy = (from: number, to: number): PolityFeature => ({
          ...f,
          properties: { ...p, y0: from, y1: to, src: "override" },
        });
        if (y0 < a) list.push(copy(y0, a));
        if (b < y1) list.push(copy(b, y1));
        if (p.src !== "override") p.cut ??= [y0, y1];
        p.y0 = Math.max(y0, a);
        p.y1 = Math.min(y1, b);
        if (p.c !== undefined) p.vc = p.c;
        p.c = lord.properties.c;
        p.v = v.label.en;
        p.v_ru = v.label.ru;
      }
    }
    // Where the overlord's own shape already covers the vassal in those years (Cliopatria
    // draws Judah inside Assyria in 700-628 BC), a second fill would make the vassal darker
    // than its empire: such a shape keeps its border and label and drops its fill (\`vin\`).
    const lordShapes = polities.features.filter(
      (f) =>
        f.properties.name === v.of &&
        !f.properties.rel &&
        f.properties.y0 < b &&
        a < f.properties.y1,
    );
    for (const f of polities.features.filter(overlaps)) {
      const ring = ((f.geometry as { coordinates: Ring[][] }).coordinates[0] ?? [])[0] ?? [];
      if (ring.length < 4) continue;
      const mid: [number, number] = [
        ring.reduce((t, [x]) => t + x, 0) / ring.length,
        ring.reduce((t, [, y]) => t + y, 0) / ring.length,
      ];
      const covered = lordShapes.some(
        (l) =>
          l.properties.y0 < f.properties.y1 &&
          f.properties.y0 < l.properties.y1 &&
          (l.geometry as { coordinates: Ring[][] }).coordinates.some((poly) =>
            pointIn(mid, poly[0] ?? []),
          ),
      );
      if (covered) (f.properties as VassalProps & { vin?: boolean }).vin = true;
    }
  }

  // A polity of many parts (the Greek city-states, Phoenicia) had a centre label on each:
  // seven "Greek city-states" at a region's view. One per shape and years keeps tier 0;
  // the others become tier 2, shown from zoom 6 (style.ts), where they no longer crowd.
  // The same pass picks the one lead point (build_data.py lead_anchor) that names the state
  // at a continent's view: the kept centre label where there is one. Each part brought its
  // own lead, and a demoted lead left the state unnamed far out (the Roman Empire, Venice).
  {
    type Label = { properties: PolityFeature["properties"] & { tier?: number; lead?: number } };
    const groups = new Map<string, Label[]>();
    for (const f of polityLabels.features as Label[]) {
      // A label left with no years by a correction must not take the place of the one drawn.
      if (f.properties.rel || f.properties.y1 <= f.properties.y0) continue;
      const key = `${f.properties.name}|${String(f.properties.y0)}`;
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    for (const group of groups.values()) {
      const centres = group.filter((f) => f.properties.tier === 0);
      const keep = centres.find((f) => f.properties.lead) ?? centres[0];
      for (const f of centres) if (f !== keep) f.properties.tier = 2;
      const lead =
        keep ??
        group.find((f) => f.properties.lead && (f.properties.tier ?? 0) < 2) ??
        group.find((f) => (f.properties.tier ?? 0) < 2) ??
        group[0];
      for (const f of group) {
        if (f === lead) f.properties.lead = 1;
        else delete f.properties.lead;
      }
    }
  }

  // Small states among the Bible's places (Judah, Israel, Philistia): their label point,
  // the middle of the shape, fell among the towns of the hills, whose names always win
  // (style.ts places them first), so at a region's view the kingdoms went unnamed. Their
  // label moves to the point of the shape farthest from any place named by zoom 6 (rank 2
  // or less), at least 0.12° inside the border. Deterministic: a rerun keeps the point.
  {
    const LEVANT = { w: 33.5, s: 28.5, e: 38, n: 35 };
    const cos = Math.cos((32 * Math.PI) / 180);
    const marks = places.features
      .filter((f) => f.properties.rank <= 2)
      .map((f) => f.geometry.coordinates as [number, number]);
    const near = ([x, y]: [number, number]) =>
      Math.min(...marks.map(([mx, my]) => Math.hypot((mx - x) * cos, my - y)));
    const toEdge = ([x, y]: [number, number], ring: Ring) => {
      let best = Infinity;
      for (let k = 0; k + 1 < ring.length; k++) {
        const [ax, ay] = ring[k] ?? [0, 0];
        const [bx, by] = ring[k + 1] ?? [0, 0];
        const dx = (bx - ax) * cos;
        const dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, ((x - ax) * cos * dx + (y - ay) * dy) / len)) : 0;
        best = Math.min(best, Math.hypot((x - ax) * cos - t * dx, y - ay - t * dy));
      }
      return best;
    };
    const inside = ([x, y]: [number, number], ring: Ring) => {
      let isIn = false;
      for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
        const [xk, yk] = ring[k] ?? [0, 0];
        const [xm, ym] = ring[m] ?? [0, 0];
        if (yk > y !== ym > y && x < ((xm - xk) * (y - yk)) / (ym - yk) + xk) isIn = !isIn;
      }
      return isIn;
    };
    for (const f of polityLabels.features as {
      geometry: { coordinates: [number, number] };
      properties: PolityFeature["properties"] & { tier?: number; size?: number };
    }[]) {
      const at = f.geometry.coordinates;
      const p = f.properties;
      // Pinned afresh on every build.
      delete (p as { pin?: boolean }).pin;
      if (p.rel || (p.tier ?? 0) !== 0 || (p.size ?? 9) > 2.6) continue;
      if (at[0] < LEVANT.w || at[0] > LEVANT.e || at[1] < LEVANT.s || at[1] > LEVANT.n) continue;
      const shape = polities.features.find(
        (s) =>
          s.properties.name === p.name &&
          !s.properties.rel &&
          s.properties.y0 <= p.y0 &&
          p.y0 < s.properties.y1,
      );
      const polys = (shape?.geometry as { coordinates: Ring[][] } | undefined)?.coordinates ?? [];
      // The largest part by area: where the label belongs; and its middle, which the label
      // stays near (within 0.5°), so a kingdom is not named in an empty corner of it.
      const parts = polys.map((poly) => {
        const r = poly[0] ?? [];
        let a2 = 0;
        let cx = 0;
        let cy = 0;
        for (let k = 0; k + 1 < r.length; k++) {
          const [x0, y0] = r[k] ?? [0, 0];
          const [x1, y1] = r[k + 1] ?? [0, 0];
          const c = x0 * y1 - x1 * y0;
          a2 += c;
          cx += (x0 + x1) * c;
          cy += (y0 + y1) * c;
        }
        return {
          ring: r,
          area: Math.abs(a2) / 2,
          mid: [cx / (3 * a2), cy / (3 * a2)] as [number, number],
        };
      });
      const part = parts.sort((p1, p2) => p2.area - p1.area)[0];
      if (!part || part.ring.length < 4 || !Number.isFinite(part.mid[0])) continue;
      const { ring, mid } = part;
      const xs = ring.map(([x]) => x);
      const ys = ring.map(([, y]) => y);
      const RADIUS = 0.5;
      let best: [number, number] | null = null;
      let score = -1;
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.04)
        for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.04) {
          const c: [number, number] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
          if (Math.hypot((c[0] - mid[0]) * cos, c[1] - mid[1]) > RADIUS) continue;
          if (!inside(c, ring) || toEdge(c, ring) < 0.12) continue;
          const d = near(c);
          if (d > score + 1e-9) {
            score = d;
            best = c;
          }
        }
      // No room inside (a sliver of a shape): the label stays where the pipeline put it.
      if (!best) continue;
      f.geometry.coordinates = best;
      (p as { pin?: boolean }).pin = true;
    }
  }

  // Copies made by a correction that came to cover no years (renamed twice in a swap) are
  // dropped: they draw nothing and are made again on every build.
  polities.features = polities.features.filter(
    (f) => f.properties.src !== "override" || f.properties.y1 > f.properties.y0,
  );
  polityLabels.features = polityLabels.features.filter(
    (f) => f.properties.src !== "override" || f.properties.y1 > f.properties.y0,
  );

  // Polity labels get their Russian name; every label on the map must have one.
  const polityNames = PolityNamesFile.parse(load("content/polity-names.yaml")).polities;
  const labelsPath = join(out, "polity-labels.geojson");
  const labels = polityLabels as { features: { properties: { name: string; name_ru?: string } }[] };
  const missing = new Set<string>();
  for (const f of labels.features) {
    const ru = polityNames[f.properties.name];
    if (ru) f.properties.name_ru = ru;
    else missing.add(f.properties.name);
  }
  for (const name of missing) errors.push(`polity-names: no Russian name for "${name}"`);
  // The shapes carry the name too: the map names a territory under the pointer.
  for (const f of polities.features as { properties: { name: string; name_ru?: string } }[]) {
    const ru = polityNames[f.properties.name];
    if (ru) f.properties.name_ru = ru;
  }
  const early = <T extends { properties: { y0?: number } }>(fs: T[]) =>
    fs.filter((f) => (f.properties.y0 ?? 0) <= POLITY_SPLIT);
  const late = <T extends { properties: { y0?: number } }>(fs: T[]) =>
    fs.filter((f) => (f.properties.y0 ?? 0) > POLITY_SPLIT);
  // Three decimals (about 100 m) for borders drawn at a region's zoom: the float noise some
  // points carried ("31.593257904052734") was 16% of the first frame's states.
  const fc = (features: unknown[]) =>
    JSON.stringify({ type: "FeatureCollection", features }, (_, v: unknown) =>
      typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v,
    );
  writes.push([polityPath, fc(early(polities.features))]);
  writes.push([polityLatePath, fc(late(polities.features))]);
  writes.push([labelsPath, fc(early(labels.features as PolityFeature[]))]);
  writes.push([labelsLatePath, fc(late(labels.features as PolityFeature[]))]);
  writes.push([join(out, "polities-all.geojson"), fc(polities.features)]);
  writes.push([join(out, "polity-labels-all.geojson"), fc(labels.features)]);
}
