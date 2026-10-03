import { describe, expect, it } from "vitest";
import type { LoadedData } from "./data";
import { timelineEventsOf } from "./timeline-events";

const t = (key: string, o: { name: string }) => `${key}:${o.name}`;
const y = (year: number) => ({ year, approximate: false });
const place = (id: string, name: string, where_tpl?: string) => ({
  props: { id, name, name_ru: name, ...(where_tpl ? { where_tpl } : {}) },
});

const data = {
  byId: new Map([
    ["j", place("j", "Jerusalem")],
    ["z", place("z", "Zion", "same")],
    ["c", place("c", "Corinth")],
  ]),
  life: {
    j: { until: y(70), gap: { from: y(-585), until: y(-538) }, note: {}, sources: ["x"] },
    z: { until: y(70), gap: { from: y(-585), until: y(-538) }, note: {}, sources: ["x"] },
    c: { gap: { from: y(-145), until: y(-44) }, note: {}, sources: ["x"] },
  },
  events: [
    {
      id: "fall",
      year: -585,
      approximate: true,
      title: { en: "Jerusalem falls" },
      place: "j",
      sources: ["x"],
    },
  ],
} as unknown as Pick<LoadedData, "life" | "byId" | "events">;

describe("timelineEventsOf", () => {
  const events = timelineEventsOf(data, "en", t);

  it("puts turning points first and marks them major", () => {
    expect(events[0]).toMatchObject({ year: -585, label: "Jerusalem falls", major: true });
  });

  it("does not repeat a turning point as a town's own event", () => {
    expect(events.filter((e) => e.year === -585)).toHaveLength(1);
  });

  it("marks a rebuilding the year after the last year in ruins", () => {
    expect(events).toContainEqual({
      year: -537,
      label: "events.rebuilt:Jerusalem",
      approximate: false,
      place: "j",
    });
    expect(events).toContainEqual({
      year: -43,
      label: "events.rebuilt:Corinth",
      approximate: false,
      place: "c",
    });
  });

  it("does not mark another name of a place again", () => {
    expect(events.some((e) => e.label.endsWith(":Zion"))).toBe(false);
  });
});
