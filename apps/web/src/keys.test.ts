import { describe, expect, it } from "vitest";
import { keyAction, type KeyInput } from "./keys";

const k = (key: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  focus: "none",
  ...over,
});

describe("keyAction", () => {
  it("moves the year by 10, and by 100 with Shift", () => {
    expect(keyAction(k("]"))).toEqual({ kind: "year", delta: 10 });
    expect(keyAction(k("{", { shiftKey: true }))).toEqual({ kind: "year", delta: -100 });
  });

  it("leaves typing in a field alone, Escape included (the field clears itself)", () => {
    expect(keyAction(k("]", { focus: "text" }))).toBeNull();
    expect(keyAction(k("n", { focus: "text" }))).toBeNull();
  });

  it("lets a focused button take Space, but map keys still work there", () => {
    expect(keyAction(k(" ", { focus: "button" }))).toBeNull();
    expect(keyAction(k("]", { focus: "button" }))).toEqual({ kind: "year", delta: 10 });
    expect(keyAction(k("Escape", { focus: "button" }))).toEqual({ kind: "close" });
  });

  it("shares keys with the slider and ignores shortcuts with modifiers", () => {
    expect(keyAction(k(" ", { focus: "slider" }))).toEqual({ kind: "play" });
    expect(keyAction(k("n", { metaKey: true }))).toBeNull();
  });

  it("gives the arrows to tour stops, except on the slider", () => {
    expect(keyAction(k("ArrowRight"))).toEqual({ kind: "stop", delta: 1 });
    expect(keyAction(k("ArrowLeft", { focus: "button" }))).toEqual({ kind: "stop", delta: -1 });
    expect(keyAction(k("ArrowRight", { focus: "slider" }))).toBeNull();
    expect(keyAction(k("ArrowLeft", { focus: "text" }))).toBeNull();
  });
});
