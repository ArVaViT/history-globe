import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Engine } from "@hg/core";
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
function engine() {
  const calls: [string, ...unknown[]][] = [];
  const state = {
    year: 30,
    locale: "ru",
    layers: { borders: true, places: true, relief: true, routes: true, roads: true, ancient: true },
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
        layers: { relief: false, roads: "off" },
        camera: { center: [35.2, 100], zoom: 99 },
      },
    });
    expect(calls).toEqual([
      ["selectPlace", "a15257a"],
      ["setLayer", "relief", false],
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
});
