import { describe, expect, it } from "vitest";
import {
  createEngine,
  YEAR_MAX,
  YEAR_MIN,
  zoomForSpread,
  type PlaceInfo,
  type Tour,
} from "./engine.ts";
import { FakeRenderer } from "./fake-renderer.ts";

const places = new Map<string, PlaceInfo>([
  ["capernaum", { id: "capernaum", at: [35.575, 32.881], kind: "settlement" }],
  ["galilee", { id: "galilee", at: [35.4, 32.8], kind: "region" }],
  ["antioch", { id: "antioch", at: [36.17, 36.23], kind: "settlement" }],
]);

const tour: Tour = {
  id: "paul-1",
  year: 47,
  stops: [
    { placeId: "antioch", at: [36.17, 36.23], ref: "Acts.13.1-Acts.13.3", note: {} },
    { placeId: "missing", at: [35.92, 36.12], ref: "Acts.13.4", note: {}, year: 48 },
  ],
};

function setup() {
  const renderer = new FakeRenderer();
  const engine = createEngine({ renderer, places, tours: [tour] });
  return { renderer, engine };
}

describe("engine", () => {
  it("pushes the initial state to the renderer once", () => {
    const { renderer } = setup();
    expect(renderer.calls.map((c) => c.op)).toEqual([
      "year",
      "locale",
      "layers",
      "selected",
      "tourPlaces",
      "route",
    ]);
  });

  it("clamps and rounds years", () => {
    const { engine, renderer } = setup();
    engine.setYear(-99999);
    expect(renderer.last("year")?.year).toBe(YEAR_MIN);
    engine.setYear(1e6);
    expect(renderer.last("year")?.year).toBe(YEAR_MAX);
    engine.setYear(-585.4);
    expect(engine.store.get().year).toBe(-585);
  });

  it("keeps only what the data can show from a link's initial state", () => {
    const renderer = new FakeRenderer();
    const engine = createEngine({
      renderer,
      places,
      initial: { year: Number.NaN, selectedPlace: "a000000" },
    });
    expect(Number.isFinite(engine.store.get().year)).toBe(true);
    expect(engine.store.get().selectedPlace).toBeNull();
    const far = createEngine({ renderer: new FakeRenderer(), places, initial: { year: 5000 } });
    expect(far.store.get().year).toBe(YEAR_MAX);
  });

  it("does not re-send unchanged state", () => {
    const { engine, renderer } = setup();
    const before = renderer.calls.length;
    engine.setYear(engine.store.get().year);
    expect(renderer.calls.length).toBe(before);
  });

  it("selects a known place and flies closer for a town than for a region", () => {
    const { engine, renderer } = setup();
    engine.selectPlace("galilee");
    const regionZoom = renderer.last("flyTo")?.zoom ?? 0;
    engine.selectPlace("capernaum");
    expect(renderer.last("selected")?.placeId).toBe("capernaum");
    expect(renderer.last("flyTo")?.zoom).toBeGreaterThan(regionZoom);
  });

  it("ignores unknown places", () => {
    const { engine } = setup();
    engine.selectPlace("atlantis");
    expect(engine.store.get().selectedPlace).toBeNull();
  });

  it("selects without flying when the user clicks the map", () => {
    const { renderer } = setup();
    const flights = renderer.calls.filter((c) => c.op === "flyTo").length;
    renderer.emitPick("capernaum");
    expect(renderer.last("selected")?.placeId).toBe("capernaum");
    expect(renderer.calls.filter((c) => c.op === "flyTo").length).toBe(flights);
  });

  it("runs a tour: sets its year, draws the route so far, selects known stops only", () => {
    const { engine, renderer } = setup();
    engine.startTour("paul-1");
    expect(engine.store.get().year).toBe(47);
    expect(renderer.last("route")).toEqual({ op: "route", points: 1, current: 0 });
    engine.goToStop(1);
    expect(renderer.last("route")).toEqual({ op: "route", points: 2, current: 1 });
    expect(engine.store.get().selectedPlace).toBeNull();
    // A stop with its own year moves the slider; back at a stop without one, the tour's.
    expect(engine.store.get().year).toBe(48);
    engine.goToStop(0);
    expect(engine.store.get().year).toBe(47);
    engine.goToStop(1);
    engine.stopTour();
    expect(renderer.last("route")).toEqual({ op: "route", points: 0, current: -1 });
  });

  it("starts a tour at a given stop and tells the renderer its places", () => {
    const { engine, renderer } = setup();
    engine.startTour("paul-1", 1);
    expect(engine.store.get().tour).toEqual({ id: "paul-1", step: 1 });
    expect(renderer.last("tourPlaces")).toEqual({ op: "tourPlaces", count: 2 });
    engine.startTour("paul-1", 9);
    expect(engine.store.get().tour?.step).toBe(1);
    engine.stopTour();
    expect(renderer.last("tourPlaces")).toEqual({ op: "tourPlaces", count: 0 });
  });

  it("leaves a tour when another place is picked, not the stop's own", () => {
    const { engine, renderer } = setup();
    engine.startTour("paul-1");
    engine.selectPlace("antioch");
    expect(engine.store.get().tour).not.toBeNull();
    renderer.emitPick("capernaum");
    expect(engine.store.get().tour).toBeNull();
    expect(engine.store.get().selectedPlace).toBe("capernaum");
  });
});

describe("camera commands", () => {
  it("turns north up without moving away", () => {
    const { engine, renderer } = setup();
    engine.lookAt([35.2, 31.7]);
    engine.northUp();
    expect(renderer.getCamera()).toMatchObject({ center: [35.2, 31.7], bearing: 0 });
  });
});

describe("camera in the store", () => {
  it("holds the settled view the renderer reports", () => {
    const { engine } = setup();
    expect(engine.store.get().camera).not.toBeNull();
    engine.lookAt([23.7, 37.97]);
    expect(engine.store.get().camera?.center).toEqual([23.7, 37.97]);
  });
});

describe("zoomForSpread", () => {
  it("keeps 7.6 for a long journey and comes closer for a walk through a city", () => {
    expect(
      zoomForSpread([
        [35.2, 31.8],
        [12.5, 41.9],
      ]),
    ).toBe(7.6);
    expect(
      zoomForSpread([
        [35.23, 31.78],
        [35.24, 31.77],
        [35.235, 31.775],
      ]),
    ).toBeGreaterThan(12);
    expect(zoomForSpread([])).toBe(7.6);
  });
});
