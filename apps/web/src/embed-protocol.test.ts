import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRenderer, type Engine } from "@hg/core";
import type { LoadedData } from "./data";
import { attachEmbed } from "./embed-protocol";

/** A page in a frame: its parent and the messages it listens to. */
function frame() {
  const listeners: ((e: MessageEvent) => void)[] = [];
  const parent = { postMessage: vi.fn() };
  vi.stubGlobal("window", {
    parent,
    addEventListener: (_: string, f: (e: MessageEvent) => void) => listeners.push(f),
    removeEventListener: vi.fn(),
    setTimeout: (f: () => void) => setTimeout(f, 0),
    clearTimeout: (t: number) => {
      clearTimeout(t);
    },
  });
  const send = (data: unknown, source: unknown = parent) => {
    for (const f of listeners) f({ data, source } as MessageEvent);
  };
  return { parent, send };
}

/** An engine that records what it is asked to do. */
function engine(more: Record<string, unknown> = {}) {
  const calls: [string, ...unknown[]][] = [];
  const state = {
    year: 30,
    locale: "ru",
    layers: { borders: true, places: true, relief: true, routes: true, roads: true },
    selectedPlace: null,
    tour: null,
    ...more,
  };
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const e = {
    store: { get: () => state, subscribe: () => () => undefined },
    setLocale: record("setLocale"),
    setYear: record("setYear"),
    startTour: record("startTour"),
    focusPlaces: record("focusPlaces"),
    selectPlace: record("selectPlace"),
    setLayer: record("setLayer"),
    stopTour: record("stopTour"),
  } as unknown as Engine;
  return { e, calls };
}

const data = {
  tours: [{ id: "paul-1" }],
  byId: new Map([["a15257a", {}]]),
} as unknown as LoadedData;

describe("the embed protocol, as a host's untrusted messages reach it", () => {
  let f: ReturnType<typeof frame>;
  beforeEach(() => {
    f = frame();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says it is ready, and ignores messages from anyone but the parent or of another version", () => {
    const { e, calls } = engine();
    attachEmbed(undefined, e, data);
    expect(f.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hg:ready", v: 1 }),
      "*",
    );
    f.send({ type: "hg:set-locale", v: 1, locale: "en" }, {});
    f.send({ type: "hg:set-locale", v: 2, locale: "en" });
    f.send("hg:set-locale");
    expect(calls).toEqual([]);
  });

  it("takes a language the site has, and no other", () => {
    const { e, calls } = engine();
    attachEmbed(undefined, e, data);
    f.send({ type: "hg:set-locale", v: 1, locale: "xx" });
    f.send({ type: "hg:set-locale", v: 1, locale: "en" });
    expect(calls).toEqual([["setLocale", "en"]]);
  });

  it("takes a view's known parts and drops the rest", () => {
    const { e, calls } = engine();
    const flyTo = vi.fn();
    attachEmbed({ flyTo }, e, data);
    f.send({
      type: "hg:set-view",
      v: 1,
      view: {
        year: Number.NaN,
        tour: "no-such-tour",
        place: "a15257a",
        layers: { relief: false, roads: "off", battles: false },
        camera: { center: [35.2, 100], zoom: 99 },
      },
    });
    expect(calls).toEqual([
      ["selectPlace", "a15257a"],
      ["setLayer", "relief", false],
      ["setLayer", "battles", false],
    ]);
    // The latitude held to the map's 85°, the zoom to 22.
    expect(flyTo).toHaveBeenCalledWith({ center: [expect.closeTo(35.2, 6), 85], zoom: 22 }, 1200);
  });

  it("starts a known tour at its stop", () => {
    const { e, calls } = engine();
    attachEmbed(undefined, e, data);
    f.send({ type: "hg:set-view", v: 1, view: { tour: "paul-1", stop: 3, year: -5.4 } });
    expect(calls).toEqual([
      ["setYear", -5],
      ["startTour", "paul-1", 2],
    ]);
  });

  it("tells the host the place picked on the map, for a map-only host's own box", async () => {
    const { e } = engine();
    // The store as the engine leaves it when a place is clicked or set by the host.
    const state: Record<string, unknown> = { ...e.store.get(), selectedPlace: null };
    let changed: () => void = () => undefined;
    const store = {
      get: () => state,
      subscribe: (f: () => void) => {
        changed = f;
        return () => undefined;
      },
    };
    attachEmbed(undefined, { ...e, store } as unknown as Engine, data);
    state.selectedPlace = "a15257a";
    changed();
    await new Promise((r) => setTimeout(r, 5));
    const [message, target] = f.parent.postMessage.mock.lastCall as [
      { type: string; v: number; view: { place?: string } },
      string,
    ];
    expect(message).toMatchObject({ type: "hg:view-changed", v: 1 });
    expect(message.view.place).toBe("a15257a");
    expect(target).toBe("*");
  });

  it("clears the selection on `place: null`, and a tour under way with it", () => {
    const one = engine({ selectedPlace: "a15257a" });
    attachEmbed(undefined, one.e, data);
    f.send({ type: "hg:set-view", v: 1, view: { place: null } });
    expect(one.calls).toEqual([["selectPlace", null]]);

    const touring = engine({ selectedPlace: "a15257a", tour: { id: "paul-1", step: 2 } });
    attachEmbed(undefined, touring.e, data);
    f.send({ type: "hg:set-view", v: 1, view: { place: null } });
    expect(touring.calls).toEqual([["selectPlace", null], ["stopTour"]]);

    // Nothing selected: nothing to do.
    const none = engine();
    attachEmbed(undefined, none.e, data);
    f.send({ type: "hg:set-view", v: 1, view: { place: null } });
    expect(none.calls).toEqual([]);
  });

  it("flies back to the place already selected, unless the view names a camera", () => {
    const { e, calls } = engine({ selectedPlace: "a15257a" });
    attachEmbed(undefined, e, data);
    f.send({ type: "hg:set-view", v: 1, view: { place: "a15257a" } });
    expect(calls).toEqual([["selectPlace", "a15257a"]]);
    // The view the host was told, sent back: the reader's camera stays.
    f.send({
      type: "hg:set-view",
      v: 1,
      view: { place: "a15257a", camera: { center: [35.2, 32], zoom: 8 } },
    });
    expect(calls).toEqual([["selectPlace", "a15257a"]]);
    // A place the data does not have is passed over.
    f.send({ type: "hg:set-view", v: 1, view: { place: "a000000" } });
    expect(calls).toEqual([["selectPlace", "a15257a"]]);
  });

  it("tells the host every click on a place, the selected one again too", () => {
    const { e } = engine({ selectedPlace: "a15257a" });
    const renderer = new FakeRenderer();
    attachEmbed(renderer, e, data);
    renderer.emitPick("a15257a");
    renderer.emitPick("a15257a");
    const clicks = f.parent.postMessage.mock.calls.filter(
      ([m]) => (m as { type: string }).type === "hg:place-clicked",
    );
    expect(clicks).toEqual([
      [{ type: "hg:place-clicked", v: 1, place: "a15257a" }, "*"],
      [{ type: "hg:place-clicked", v: 1, place: "a15257a" }, "*"],
    ]);
  });

  it("clears the selection on a click on the map itself only when map-only", () => {
    const shared = engine({ selectedPlace: "a15257a" });
    const r1 = new FakeRenderer();
    attachEmbed(r1, shared.e, data);
    r1.emitPickNone();
    expect(shared.calls).toEqual([]);

    const bare = engine({ selectedPlace: "a15257a" });
    const r2 = new FakeRenderer();
    const undo = attachEmbed(r2, bare.e, data, true);
    r2.emitPickNone();
    expect(bare.calls).toEqual([["selectPlace", null]]);
    // A tour under way goes on: only the place is put away.
    const touring = engine({ selectedPlace: "a15257a", tour: { id: "paul-1", step: 1 } });
    const r3 = new FakeRenderer();
    attachEmbed(r3, touring.e, data, true);
    r3.emitPickNone();
    expect(touring.calls).toEqual([["selectPlace", null]]);
    // Undone with the protocol: the frame's listeners go.
    undo();
    r2.emitPickNone();
    expect(bare.calls).toEqual([["selectPlace", null]]);
  });
});
