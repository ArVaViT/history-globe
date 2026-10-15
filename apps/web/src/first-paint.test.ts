import { afterEach, describe, expect, it, vi } from "vitest";
import { firstPaint } from "./first-paint";

type Listener = (list: { getEntriesByName: (name: string) => unknown[] }) => void;

/** A PerformanceObserver that reports the paints it is given, and a shown or hidden tab. */
function stubBrowser(visibility: "visible" | "hidden", paints: string[] = []) {
  const observers: Listener[] = [];
  class FakeObserver {
    static supportedEntryTypes = ["paint", "largest-contentful-paint"];
    disconnected = false;
    readonly cb: Listener;
    constructor(cb: Listener) {
      this.cb = cb;
      observers.push(cb);
    }
    observe() {
      this.cb({ getEntriesByName: (name) => paints.filter((p) => p === name) });
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  vi.stubGlobal("PerformanceObserver", FakeObserver);
  vi.stubGlobal("document", { visibilityState: visibility });
  return {
    paint: (name: string) => {
      for (const cb of observers) cb({ getEntriesByName: (n) => (n === name ? [name] : []) });
    },
  };
}

const settled = async (p: Promise<void>) => {
  let done = false;
  void p.then(() => (done = true));
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe("firstPaint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("waits for the first contentful paint", async () => {
    const browser = stubBrowser("visible");
    const p = firstPaint();
    expect(await settled(p)).toBe(false);
    browser.paint("first-paint");
    expect(await settled(p)).toBe(false);
    browser.paint("first-contentful-paint");
    expect(await settled(p)).toBe(true);
  });

  it("resolves at once when the paint is already reported", async () => {
    stubBrowser("visible", ["first-contentful-paint"]);
    expect(await settled(firstPaint())).toBe(true);
  });

  it("does not wait in a tab that is not shown, which paints nothing", async () => {
    stubBrowser("hidden");
    expect(await settled(firstPaint())).toBe(true);
  });

  it("does not wait where the browser reports no paints", async () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    expect(await settled(firstPaint())).toBe(true);
  });

  it("gives up after two seconds", async () => {
    vi.useFakeTimers();
    stubBrowser("visible");
    const p = firstPaint();
    vi.advanceTimersByTime(1999);
    expect(await settled(p)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(await settled(p)).toBe(true);
  });
});
