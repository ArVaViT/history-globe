import { describe, expect, it, vi } from "vitest";
import {
  agentTools,
  findPlace,
  placeResult,
  registerAgentTools,
  searchResult,
  type AgentContext,
  type AgentTool,
} from "./agent-tools";
import type { Article } from "./articles";
import type { LoadedData, PlaceProps } from "./data";
import { modelContext, offerAgentTools } from "./webmcp";

function place(id: string, name: string, extra: Partial<PlaceProps> = {}): PlaceProps {
  return {
    id,
    name,
    kind: "settlement",
    sites: 1,
    disputed: false,
    verses: 2,
    nt: 0,
    ot: 2,
    rank: 0,
    where: "",
    osis: ["Gen.12.6", "Acts.16.12"],
    coord: "openbible",
    ...extra,
  };
}

const list = [
  place("a1", "Jerusalem", { name_ru: "Иерусалим", name_de: "Jerusalem", verses: 800 }),
  place("a2", "Philippi", { name_ru: "Филиппы", where: "Filippoi", where_tpl: "name" }),
  place("a3", "Aphek", { rank: 1 }),
  place("a4", "Aphek", { rank: 2 }),
  place("a5", "Nowhere", { verses: 0, osis: [] }),
];
const data = {
  places: {
    type: "FeatureCollection",
    features: list.map((p, i) => ({
      type: "Feature",
      properties: p,
      geometry: { type: "Point", coordinates: [35 + i, 31] },
    })),
  },
  byId: new Map(list.map((p, i) => [p.id, { props: p, info: { id: p.id, at: [35 + i, 31] } }])),
} as unknown as LoadedData;

const article = {
  title: { en: "The city", ru: "Город" },
  body: { en: ["One.", "Two."], ru: ["Раз.", "Два."] },
  status: "checked",
} as unknown as Article;

const ctx: AgentContext = {
  data,
  site: "https://historyglobe.app/",
  language: () => "ru",
  article: (id) => Promise.resolve(id === "a1" ? article : undefined),
};

describe("agent tools", () => {
  it("search in the map's language, with pages and the map's link", () => {
    const r = searchResult(ctx, { query: "иерус" });
    expect(r.lang).toBe("ru");
    expect(r.places).toEqual([
      {
        id: "a1",
        name: "Иерусалим",
        name_en: "Jerusalem",
        kind: "settlement",
        lat: 31,
        lon: 35,
        verses: 800,
        page: "https://historyglobe.app/ru/place/jerusalem/",
        map: "https://historyglobe.app/?place=a1&locale=ru",
      },
    ]);
  });

  it("answers in the language asked for, and says when nothing is found", () => {
    const r = searchResult(ctx, { query: "philip", lang: "en-GB" });
    expect(r.lang).toBe("en");
    expect(r.places[0]).toMatchObject({ name: "Philippi", today: "Filippoi" });
    expect(r.places[0]).not.toHaveProperty("name_en");
    expect(searchResult(ctx, { query: "zzz" }).note).toBeDefined();
    // A language the site is not published in: the map's.
    expect(searchResult(ctx, { query: "jer", lang: "xx" }).lang).toBe("ru");
  });

  it("finds a place by id, by its page's slug or by its exact name", () => {
    expect(findPlace(data, "a2")?.id).toBe("a2");
    expect(findPlace(data, "philippi")?.id).toBe("a2");
    expect(findPlace(data, "https://historyglobe.app/en/place/aphek-a4/")?.id).toBe("a4");
    expect(findPlace(data, "Филиппы")?.id).toBe("a2");
    expect(findPlace(data, "Phil")).toBeUndefined();
  });

  it("gives a place with its verses and article, no page where no verse names it", async () => {
    const r = await placeResult(ctx, { place: "jerusalem", lang: "de" });
    expect(r).toMatchObject({
      id: "a1",
      name: "Jerusalem",
      verses_count: 800,
      verses: [{ osis: "Gen.12.6" }, { osis: "Acts.16.12" }],
      // German has no article text yet: the English one.
      article: { title: "The city", paragraphs: ["One.", "Two."] },
      page: "https://historyglobe.app/de/place/jerusalem/",
    });
    expect((r as { verses: { ref: string }[] }).verses[0]?.ref).toMatch(/12:6$/);
    const none = await placeResult(ctx, { place: "Nowhere" });
    expect(none).not.toHaveProperty("page");
    expect(none).not.toHaveProperty("article");
    expect(await placeResult(ctx, { place: "Atlantis" })).toHaveProperty("error");
  });

  it("registers two read-only tools, and stops when aborted", async () => {
    const registered: AgentTool[] = [];
    const mc = {
      registerTool: vi.fn((tool: AgentTool) => {
        registered.push(tool);
        return Promise.resolve();
      }),
    };
    await registerAgentTools(mc, ctx, new AbortController().signal);
    expect(registered.map((t) => t.name)).toEqual(["search_places", "get_place"]);
    expect(registered.map((t) => t.annotations)).toEqual([
      { readOnlyHint: true },
      { readOnlyHint: true },
    ]);
    const ac = new AbortController();
    ac.abort();
    await registerAgentTools(mc, ctx, ac.signal);
    expect(registered).toHaveLength(2);
    // A browser that refuses a tool does not break the map.
    await expect(
      registerAgentTools(
        { registerTool: () => Promise.reject(new Error("NotAllowedError")) },
        ctx,
        new AbortController().signal,
      ),
    ).resolves.toBeUndefined();
    expect(agentTools(ctx).every((t) => JSON.stringify(t.inputSchema).length > 0)).toBe(true);
  });
});

describe("webmcp", () => {
  const mc = { registerTool: () => undefined };
  it("finds the model context on the document first, then on the navigator", () => {
    expect(modelContext({ modelContext: mc }, {})).toBe(mc);
    expect(modelContext({}, { modelContext: mc })).toBe(mc);
    expect(modelContext({}, {})).toBeUndefined();
    expect(modelContext({ modelContext: {} }, {})).toBeUndefined();
  });

  it("does nothing in a browser without it", () => {
    const stop = offerAgentTools(ctx);
    expect(typeof stop).toBe("function");
    stop();
  });
});
