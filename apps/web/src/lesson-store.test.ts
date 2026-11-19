import { afterEach, describe, expect, it, vi } from "vitest";

describe("the lesson kept in this browser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("carries a lesson kept under the old keys over to the new ones", async () => {
    const kept = new Map<string, string>([
      ["hg-lesson", JSON.stringify([{ id: "a15257a", year: 30 }])],
      ["hg-lesson-title", "Paul"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => kept.set(k, v),
      removeItem: (k: string) => kept.delete(k),
    });
    const { addToLesson } = await import("./lesson-store");
    expect(addToLesson({ id: "af2161c", year: 50 })).toBe(true);
    expect(JSON.parse(kept.get("hg:lesson") ?? "[]")).toEqual([
      { id: "a15257a", year: 30 },
      { id: "af2161c", year: 50 },
    ]);
    expect(kept.get("hg:lesson-title")).toBe("Paul");
    expect(kept.has("hg-lesson")).toBe(false);
    expect(kept.has("hg-lesson-title")).toBe(false);
  });
});
