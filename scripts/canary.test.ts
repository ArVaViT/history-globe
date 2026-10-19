import { describe, expect, it } from "vitest";
import { Canaries, RATES } from "./canary.ts";

const paragraphs = [
  "Jericho lies in the Jordan Valley. The spring made it an oasis. People settled there c. 9000 BC.",
  "That city was destroyed by fire. In the Bible, Joshua sends spies to Rahab.",
];
/** Enough texts for some to be picked at the rates, whatever the seed. */
const ids = Array.from({ length: 400 }, (_, i) => `a${i.toString(16).padStart(6, "0")}`);

describe("canaries", () => {
  it("place nothing and report nothing to write without a seed", () => {
    const c = new Canaries("");
    expect(c.on).toBe(false);
    expect(c.text("f", "x", "en", paragraphs)).toEqual(paragraphs);
    expect(c.swap("f", ids, (id) => id)).toEqual(ids);
    expect(c.keys("f", "x", { lon: 1, lat: 2 })).toEqual({ lon: 1, lat: 2 });
    expect(c.ids("f", "Gen.1.1", ["a", "b"])).toEqual(["a", "b"]);
    expect(c.marks).toEqual([]);
  });

  it("follow the seed alone: the same seed, the same marks; another seed, others", () => {
    const run = (seed: string) => {
      const c = new Canaries(seed);
      for (const id of ids) c.text("f", id, "en", paragraphs);
      c.swap("f", ids, (id) => id);
      return c.marks;
    };
    expect(run("one")).toEqual(run("one"));
    expect(run("one")).not.toEqual(run("two"));
    expect(run("one").length).toBeGreaterThan(0);
  });

  it("add one space after a sentence's end and nothing else", () => {
    const c = new Canaries("seed");
    let marked: string[] | undefined;
    for (const id of ids) {
      const out = c.text("data/articles/en.json", id, "en", paragraphs);
      if (out.some((p, i) => p !== paragraphs[i])) {
        marked = out;
        break;
      }
    }
    expect(marked).toBeDefined();
    const folded = (marked ?? []).map((p) => p.replace(/ {2}/g, " "));
    expect(folded).toEqual(paragraphs);
    const changed = (marked ?? []).filter((p, i) => p !== paragraphs[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatch(/\. {2}\p{Lu}/u);
    // Never after an abbreviation before a number ("c. 9000").
    expect(changed[0]).not.toContain("c.  9000");
    const mark = c.marks.find((m) => m.kind === "text");
    expect(mark?.kind === "text" && mark.context.includes(".  ")).toBe(true);
    expect(mark?.kind === "text" && changed[0]?.includes(mark.context)).toBe(true);
  });

  it("leave a text without a sentence's end alone", () => {
    const c = new Canaries("seed");
    for (const id of ids)
      expect(c.text("f", id, "en", ["One line, no end"])).toEqual(["One line, no end"]);
    expect(c.marks).toEqual([]);
  });

  it("swap neighbours only, each record once, and keep every record", () => {
    const c = new Canaries("seed");
    const out = c.swap("api/v1/places.json", ids, (id) => id);
    expect([...out].sort()).toEqual([...ids].sort());
    const swaps = c.marks.flatMap((m) => (m.kind === "swap" ? [m] : []));
    expect(swaps.length).toBeGreaterThan(0);
    expect(swaps.length).toBeLessThan(ids.length * RATES.swap * 3);
    for (const m of swaps) {
      expect(out[m.index]).toBe(m.ids[0]);
      expect(out[m.index + 1]).toBe(m.ids[1]);
      expect(ids[m.index]).toBe(m.ids[1]);
      expect(ids[m.index + 1]).toBe(m.ids[0]);
    }
    // Every record not swapped stands where it stood.
    const moved = new Set(swaps.flatMap((m) => m.ids));
    ids.forEach((id, i) => {
      if (!moved.has(id)) expect(out[i]).toBe(id);
    });
  });

  it("reorder a record's keys without changing it, and a list's ids likewise", () => {
    const c = new Canaries("seed");
    const record = { id: "a", lon: 35.2, lat: 31.8, verses: 3 };
    let keyed = 0;
    for (const id of ids) {
      const out = c.keys("api/v1/places.json", id, record);
      expect(out).toEqual(record);
      if (Object.keys(out)[0] !== "id") {
        keyed++;
        expect(Object.keys(out)).toEqual(["lon", "lat", "verses", "id"]);
      }
      const list = c.ids("api/v1/verses/Gen.json", id, ["x", "y", "z"]);
      expect([...list].sort()).toEqual(["x", "y", "z"]);
      expect(list[2]).toBe("z");
    }
    expect(keyed).toBeGreaterThan(0);
    expect(c.marks.filter((m) => m.kind === "keys")).toHaveLength(keyed);
  });
});
