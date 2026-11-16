import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyClicks } from "./empty-click.ts";

describe("a click on the map itself", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is told once the time of a double-click has passed", () => {
    const emit = vi.fn();
    const c = emptyClicks(emit);
    c.down(false);
    c.click(false);
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("is not a click on a place", () => {
    const emit = vi.fn();
    const c = emptyClicks(emit);
    c.down(false);
    c.click(true);
    vi.advanceTimersByTime(1000);
    expect(emit).not.toHaveBeenCalled();
  });

  it("is not the release of a drag, even one a flight cut short", () => {
    const emit = vi.fn();
    const c = emptyClicks(emit);
    c.down(false);
    c.moved();
    c.click(false);
    vi.advanceTimersByTime(1000);
    expect(emit).not.toHaveBeenCalled();
  });

  it("is not a press that stopped a moving camera", () => {
    const emit = vi.fn();
    const c = emptyClicks(emit);
    c.down(true);
    c.click(false);
    vi.advanceTimersByTime(1000);
    expect(emit).not.toHaveBeenCalled();
    // The next press, on a still map, is a click again.
    c.down(false);
    c.click(false);
    vi.advanceTimersByTime(300);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("is not a double-click, nor a click followed at once by a zoom", () => {
    const emit = vi.fn();
    const c = emptyClicks(emit);
    c.down(false);
    c.click(false);
    vi.advanceTimersByTime(120);
    c.down(false);
    c.click(false);
    c.dblclick();
    vi.advanceTimersByTime(1000);
    expect(emit).not.toHaveBeenCalled();
    // A double tap: the zoom moves the camera before the wait is over.
    c.down(false);
    c.click(false);
    c.moved();
    vi.advanceTimersByTime(1000);
    expect(emit).not.toHaveBeenCalled();
  });

  it("is not the release of a drag, nor is any click that ends one", () => {
    const emit = vi.fn();
    const c = emptyClicks(emit);
    c.down(false);
    expect(c.isClick()).toBe(true);
    c.dragged();
    expect(c.isClick()).toBe(false);
    c.click(false);
    vi.advanceTimersByTime(1000);
    expect(emit).not.toHaveBeenCalled();
    // The next press starts afresh.
    c.down(false);
    expect(c.isClick()).toBe(true);
  });
});
