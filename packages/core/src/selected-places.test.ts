// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Every place of the built data, selected, is named beside its ring at the zoom the camera
 * flies to (engine.ts: zoomForKind). A reader of a host page (STEPBible) picks places from
 * its own list, any of them: a river drawn as a line was named only along its course, up the
 * Barada for Abana while its ring stood at Damascus, and no check looked at every place.
 *
 * The great towns round a selected place stay on the map: packages/core/src/majors.test.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { expression, featureFilter } from "@maplibre/maplibre-gl-style-spec";
import type { FeatureCollection } from "geojson";
import { describe, expect, it } from "vitest";
import { zoomForKind } from "./kinds.ts";
import { buildStyle } from "./style.ts";

type Props = Record<string, unknown>;
function read(name: string): FeatureCollection {
  const file = new URL(`../../../apps/web/public/data/${name}`, import.meta.url);
  if (!existsSync(file))
    throw new Error(
      `apps/web/public/data/${name} is not there: this test reads the data release; run \`pnpm data\` first (README.md, For developers). CI leaves it out.`,
    );
  return JSON.parse(readFileSync(file, "utf8")) as FeatureCollection;
}
const places = read("places.geojson");
// The ancient world's sites, as apps/web/src/data.ts ancientPlaces makes them places: towns,
// one rank down, standing from `from` to `to`.
const ancient = read("ancient.geojson").features.map((f) => {
  const p: Props = f.properties ?? {};
  const rank = [1, 2, 3][Number(p["rank"])] ?? 3;
  return {
    ...f,
    properties: {
      ...p,
      name: String(p["en"]),
      kind: "settlement",
      ancient: String(p["kind"]),
      rank,
      verses: 0,
      nt: 0,
      ot: 0,
      life_from: Number(p["from"]),
      life_until: Number(p["to"]) + 1,
    },
  };
});

const style = buildStyle({
  dataUrl: "/data",
  terrainTiles: "https://example.test/{z}/{x}/{y}.webp",
  terrainAttribution: "test",
  fonts: {},
  initialYear: 30,
  initialLocale: "en",
});
type Layer = (typeof style.layers)[number];

// The layers that draw a place picked by the reader at its own point.
const PICKED_LAYERS = ["place-label-picked", "place-label-selected"];
const layers = style.layers.filter((l) => PICKED_LAYERS.includes(l.id));

function state(selected: string, year: number): Props {
  return {
    year,
    locale: "en",
    selected,
    tourPlaces: [],
    stops: false,
    stopPlaces: [],
    bibleOnly: false,
    hiddenNames: [],
  };
}

function passes(layer: Layer, st: Props, zoom: number, props: Props): boolean {
  if (!("filter" in layer) || !layer.filter) return true;
  return featureFilter(layer.filter, "filter", st).filter({ zoom }, {
    type: 1,
    properties: props,
    geometry: [],
  } as never);
}

function text(layer: Layer, st: Props, zoom: number, props: Props): string {
  const layout = (layer as { layout?: Record<string, unknown> }).layout;
  const value = layout?.["text-field"];
  if (value === undefined) return "";
  const compiled = expression.createExpression(value, `${layer.id}.text-field`, null, st);
  if (compiled.result !== "success") throw new Error(`${layer.id} text-field does not compile`);
  const v: unknown = compiled.value.evaluate({ zoom }, {
    type: 1,
    properties: props,
    geometry: [],
  } as never);
  if (typeof v === "string") return v;
  // A Formatted value: its sections' text.
  const sections = (v as { sections?: { text: string }[] } | null)?.sections ?? [];
  return sections.map((s) => s.text).join("");
}

/**
 * The places that, selected in the year, would show their ring with no name beside it. A
 * site of the ancient world is selected in its own first year.
 */
function unnamed(features: FeatureCollection["features"], year: number | null): string[] {
  const out: string[] = [];
  for (const f of features) {
    if (f.geometry.type !== "Point") continue;
    const props = f.properties ?? {};
    const id = String(props["id"]);
    const kind = String(props["kind"]);
    // A filter sees the zoom of its tile, an integer (style-expressions.ts minZoomByRank).
    const zoom = Math.floor(zoomForKind(kind));
    const st = state(id, year ?? Number(props["life_from"]));
    const named = layers.some(
      (l) => passes(l, st, zoom, props) && text(l, st, zoom, props).trim() !== "",
    );
    if (!named) out.push(`${String(props["name"])} (${id}, ${kind})`);
  }
  return out;
}

describe("every place, selected, is named beside its ring", () => {
  it("has places to check", () => {
    expect(places.features.length).toBeGreaterThan(1000);
    expect(ancient.length).toBeGreaterThan(1000);
  });

  for (const year of [30, -1000]) {
    it(`a place of the Bible in ${String(year)}`, () => {
      expect(unnamed(places.features, year)).toEqual([]);
    });
  }

  it("a site of the ancient world, in its first year", () => {
    expect(unnamed(ancient, null)).toEqual([]);
  });
});
