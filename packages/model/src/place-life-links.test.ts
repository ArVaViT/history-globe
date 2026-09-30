import { describe, expect, it } from "vitest";
import type { PlaceLife } from "./content.ts";
import { inheritLife, type LinkedPlace } from "./place-life-links.ts";

const y = (year: number) => ({ year, approximate: false });
const jerusalem: PlaceLife = {
  until: y(70),
  gap: { from: y(-585), until: y(-538) },
  note: { en: "Burnt.", ru: "Сожжён." },
  sources: ["2 Kgs 25"],
};
const samaria: PlaceLife = {
  from: y(-879),
  gap: { from: y(-107), until: y(-63) },
  note: { en: "Built by Omri.", ru: "Построена Амврием." },
  sources: ["1 Kgs 16"],
};
const rome: PlaceLife = {
  from: y(-752),
  note: { en: "Founded.", ru: "Основан." },
  sources: ["Varro"],
};
const places: LinkedPlace[] = [
  { id: "jer", name: "Jerusalem" },
  { id: "zion", name: "Zion", where_tpl: "same", where_ref: "jer" },
  { id: "millo", name: "Millo", where_tpl: "at", where_ref: "jer" },
  { id: "silla", name: "Silla", where_tpl: "at", where_ref: "millo" },
  { id: "jer2", name: "Jerusalem", where_tpl: "same", where_ref: "jer" },
  { id: "sam", name: "Samaria" },
  { id: "shamir", name: "Shamir", where_tpl: "same", where_ref: "sam" },
  { id: "rome", name: "Rome" },
  { id: "babylon", name: "Babylon", where_tpl: "same", where_ref: "rome" },
  { id: "a", name: "A", where_tpl: "same", where_ref: "b" },
  { id: "b", name: "B", where_tpl: "same", where_ref: "a" },
  { id: "near", name: "Near", where_tpl: "within", where_ref: "jer" },
];
const ru: Record<string, string> = {
  jer: "Иерусалим",
  jer2: "Иерусалим",
  zion: "Сион",
  millo: "Милло",
  silla: "Силла",
  sam: "Самария",
  shamir: "Шамир",
  rome: "Рим",
  babylon: "Вавилон",
};
const life = inheritLife(places, { jer: jerusalem, sam: samaria, rome }, (id) => ru[id]);

describe("inheritLife", () => {
  it("prefixes another name's note with the town, once, through a chain", () => {
    expect(life.zion?.note.ru).toBe("Иерусалим: Сожжён.");
    expect(life.silla?.note.ru).toBe("Иерусалим: Сожжён.");
    expect(life.silla?.note.en).toBe("Jerusalem: Burnt.");
    expect(life.jer2?.note.ru).toBe("Сожжён.");
  });

  it("carries over the ruin and the end, never the founding", () => {
    expect(life.zion?.until?.year).toBe(70);
    expect(life.shamir?.gap?.from.year).toBe(-107);
    expect(life.shamir?.from).toBeUndefined();
    expect(life.shamir?.inherited).toBe(true);
  });

  it("gives nothing when there is nothing to carry, a loop, or another kind of link", () => {
    expect(life.babylon).toBeUndefined();
    expect(life.a).toBeUndefined();
    expect(life.near).toBeUndefined();
    expect(life.jer).toBeUndefined();
  });
});
