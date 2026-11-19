import { afterEach, describe, expect, it, vi } from "vitest";
import { readPref, writePref } from "./storage";

describe("remembered settings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("read and write, and forget on null", () => {
    const kept = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => kept.set(k, v),
      removeItem: (k: string) => kept.delete(k),
    });
    writePref("hg:test", "1");
    expect(readPref("hg:test")).toBe("1");
    writePref("hg:test", null);
    expect(readPref("hg:test")).toBeNull();
  });

  it("read as nothing and write nothing when storage is refused", () => {
    const refuse = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: refuse, setItem: refuse, removeItem: refuse });
    expect(readPref("hg:test", "session")).toBeNull();
    expect(() => {
      writePref("hg:test", "1", "session");
    }).not.toThrow();
  });
});
