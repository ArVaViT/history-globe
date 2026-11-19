import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as maplibregl from "maplibre-gl";
import { describe, expect, it } from "vitest";

/**
 * The private members maplibre-internals.ts reaches into, checked against the MapLibre build
 * the app ships: an upgrade that renames one fails here rather than leaving the controls in
 * English or the credits stale.
 */
const dist = join(
  dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")),
  "dist/maplibre-gl.mjs",
);
const bundle = readFileSync(dist, "utf8");

const { AttributionControl, Map, NavigationControl, ScaleControl } = maplibregl;
const used: readonly [{ readonly prototype: object }, string][] = [
  [Map, "_locale"],
  [NavigationControl, "_setButtonTitle"],
  [NavigationControl, "_zoomInButton"],
  [NavigationControl, "_zoomOutButton"],
  [NavigationControl, "_compass"],
  [AttributionControl, "_setElementTitle"],
  [AttributionControl, "_compactButton"],
  [AttributionControl, "_container"],
  [AttributionControl, "_innerContainer"],
  [AttributionControl, "_updateAttributions"],
  [ScaleControl, "_onMove"],
];

describe("MapLibre's private members", () => {
  it("are there, as methods of the class or set on its instances", () => {
    for (const [cls, name] of used)
      expect(
        typeof (cls.prototype as Record<string, unknown>)[name] === "function" ||
          new RegExp(`this\\.${name}\\s*=`).test(bundle),
        name,
      ).toBe(true);
  });
});
