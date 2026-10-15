/**
 * WebMCP tools (webmachinelearning.github.io/webmcp): what an AI agent working in the
 * reader's browser can ask the map, without clicking through it. Two tools, both read-only:
 *
 *   search_places(query, lang?)  places by name in any language, with their pages
 *   get_place(place, lang?)      one place: names, kind, today, point, verses, article
 *
 * They read the data the map has loaded and change nothing on the screen. This module is
 * loaded only in a browser that offers WebMCP (webmcp.ts), so every other reader pays
 * nothing for it.
 */
import {
  formatRefOr,
  isLocale,
  loadLocaleData,
  LOCALES,
  placeName,
  placeSlugs,
  type SiteLocale,
} from "@hg/model";
import type { Article } from "./articles";
import { foldName, searchPlaces, whereIn, type LoadedData, type PlaceProps } from "./data";

/** The part of WebMCP's ModelContext the tools use: `document.modelContext` (Chrome 150+). */
export interface ModelContextLike {
  registerTool(tool: AgentTool, options?: { signal?: AbortSignal }): unknown;
}

export interface AgentTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: object;
  readonly annotations: { readonly readOnlyHint: true };
  readonly execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentContext {
  readonly data: LoadedData;
  /** The site's address, ending in "/" (https://historyglobe.app/). */
  readonly site: string;
  /** The language the map is shown in: the answer's language when the agent names none. */
  readonly language: () => string;
  readonly article: (placeId: string) => Promise<Article | undefined>;
}

const SEARCH_LIMIT = 10;
const VERSE_LIMIT = 50;
const LICENSE =
  'CC BY 4.0: credit "History Globe by Vadym Arnaut" (https://historyglobe.app) and OpenBible.info';

const langSchema = {
  type: "string",
  enum: [...LOCALES],
  description:
    "Language of names and texts in the answer (default: the language the map is shown in)",
};

/** The language asked for, if the site is published in it; else the map's. */
function langOf(input: Record<string, unknown>, ctx: AgentContext): SiteLocale {
  const asked = typeof input.lang === "string" ? input.lang.toLowerCase().split("-")[0] : "";
  if (isLocale(asked)) return asked;
  const shown = ctx.language();
  return isLocale(shown) ? shown : "en";
}

let slugCache: { data: LoadedData; slugs: Map<string, string> } | null = null;
/** Each place's page slug, as scripts/build-pages.ts names the pages. */
function slugs(data: LoadedData): Map<string, string> {
  if (slugCache?.data !== data)
    slugCache = { data, slugs: placeSlugs(data.places.features.map((f) => f.properties)) };
  return slugCache.slugs;
}

/** The place's page (only a place some verse names has one) and the map opened on it. */
function links(p: PlaceProps, l: SiteLocale, ctx: AgentContext) {
  const slug = slugs(ctx.data).get(p.id) ?? p.id;
  return {
    ...(p.verses > 0 ? { page: `${ctx.site}${l}/place/${slug}/` } : {}),
    map: `${ctx.site}?place=${p.id}&locale=${l}`,
  };
}

/** Where the place is today, in the language, where the data says it there. */
function today(p: PlaceProps, l: SiteLocale): string | undefined {
  const w = whereIn(p, l);
  return w && w !== placeName(p, l) ? w : undefined;
}

function point(ctx: AgentContext, id: string): { lat: number; lon: number } | undefined {
  const at = ctx.data.byId.get(id)?.info.at;
  return at ? { lat: at[1], lon: at[0] } : undefined;
}

export function searchResult(ctx: AgentContext, input: Record<string, unknown>) {
  const l = langOf(input, ctx);
  const query = typeof input.query === "string" ? input.query : "";
  const found = searchPlaces(ctx.data, query, SEARCH_LIMIT);
  return {
    query,
    lang: l,
    places: found.map(({ props: p }) => ({
      id: p.id,
      name: placeName(p, l),
      ...(l !== "en" ? { name_en: p.name } : {}),
      kind: p.kind,
      ...(today(p, l) ? { today: today(p, l) } : {}),
      ...point(ctx, p.id),
      verses: p.verses,
      ...links(p, l, ctx),
    })),
    ...(found.length === 0 ? { note: "No place by that name: try another spelling" } : {}),
  };
}

/** A place by its id ("a15257a"), its page's slug ("jerusalem") or its exact name. */
export function findPlace(data: LoadedData, key: string): PlaceProps | undefined {
  const k = key.trim();
  const byId = data.byId.get(k)?.props;
  if (byId) return byId;
  const slug = k.toLowerCase().replace(/\/+$/, "").split("/").pop() ?? "";
  for (const [id, s] of slugs(data)) if (s === slug) return data.byId.get(id)?.props;
  const folded = foldName(k);
  return searchPlaces(data, k, 1).find(
    ({ props: p }) =>
      foldName(p.name) === folded || LOCALES.some((l) => foldName(placeName(p, l)) === folded),
  )?.props;
}

export async function placeResult(ctx: AgentContext, input: Record<string, unknown>) {
  const l = langOf(input, ctx);
  const key = typeof input.place === "string" ? input.place : "";
  const p = findPlace(ctx.data, key);
  if (!p) return { error: `No place "${key}": find its id with search_places` };
  // The book names of the language asked for (fetched once, as for a reader of it).
  await loadLocaleData(l);
  const art = await ctx.article(p.id).catch(() => undefined);
  const body = art ? (art.body[l] ?? art.body.en) : undefined;
  return {
    id: p.id,
    name: placeName(p, l),
    ...(l !== "en" ? { name_en: p.name } : {}),
    kind: p.kind,
    ...(today(p, l) ? { today: today(p, l) } : {}),
    ...point(ctx, p.id),
    ...(p.disputed ? { disputed: true } : {}),
    verses_count: p.verses,
    verses: p.osis.slice(0, VERSE_LIMIT).map((osis) => ({ osis, ref: formatRefOr(osis, l) })),
    ...(p.osis.length > VERSE_LIMIT ? { more_verses_on_page: p.osis.length - VERSE_LIMIT } : {}),
    ...(art && body
      ? {
          article: {
            title: art.title[l] ?? art.title.en,
            paragraphs: body,
            status: art.status,
          },
        }
      : {}),
    ...links(p, l, ctx),
    license: LICENSE,
  };
}

export function agentTools(ctx: AgentContext): AgentTool[] {
  return [
    {
      name: "search_places",
      title: "Search Bible places",
      description:
        "Find places the Bible names on History Globe by name, in any of its languages (Jerusalem, Иерусалим, Jeruzalém). Returns up to 10 places with id, name, kind, where it is today, coordinates, how many verses name it, its page and a link that opens the globe on it.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "A place name or its start, 2 letters or more" },
          lang: langSchema,
        },
        required: ["query"],
      },
      annotations: { readOnlyHint: true },
      execute: (input) => Promise.resolve(searchResult(ctx, input)),
    },
    {
      name: "get_place",
      title: "Get a Bible place",
      description:
        "One place on History Globe: its names, kind, where it is today, coordinates, whether its location is disputed, the verses that name it (OSIS and as the language cites them), its article where there is one, its page and a link that opens the globe on it. The data is open under CC BY 4.0.",
      inputSchema: {
        type: "object",
        properties: {
          place: {
            type: "string",
            description: "The place's id from search_places, its page's slug, or its exact name",
          },
          lang: langSchema,
        },
        required: ["place"],
      },
      annotations: { readOnlyHint: true },
      execute: (input) => placeResult(ctx, input),
    },
  ];
}

/** Registers the tools; aborting the signal takes them away again. */
export async function registerAgentTools(
  mc: ModelContextLike,
  ctx: AgentContext,
  signal: AbortSignal,
): Promise<void> {
  for (const tool of agentTools(ctx)) {
    if (signal.aborted) return;
    try {
      await mc.registerTool(tool, { signal });
    } catch {
      // Refused (a permissions policy, an older shape of the API): the map works without it.
    }
  }
}
