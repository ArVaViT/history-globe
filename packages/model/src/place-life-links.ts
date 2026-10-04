import type { PlaceLife } from "./content.ts";

/** What the link resolution needs of a place (places.geojson properties). */
export interface LinkedPlace {
  readonly id: string;
  readonly name: string;
  /** "same": another name of the place it refers to; "at": inside it (a gate, a pool). */
  readonly where_tpl?: string | undefined;
  readonly where_ref?: string | undefined;
}

const MAX_HOPS = 5;

/**
 * The years of places that have none of their own but are another name of a town, or lie
 * in it, with an entry in place-life.yaml. Links are followed through chains (a gate of
 * Millo of Jerusalem) to the town with its own years; loops and other links give nothing.
 * Only the ruin and the end carry over, never the founding (Shamir of Judg 10:1, which
 * OpenBible places at Samaria, stood before Omri built Samaria), and the note is prefixed
 * with the town's name once, unless the place bears that very name.
 */
export function inheritLife(
  places: readonly LinkedPlace[],
  own: Readonly<Record<string, PlaceLife>>,
  ruName: (id: string) => string | undefined,
): Record<string, PlaceLife> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const townOf = (id: string): string | undefined => {
    let at = byId.get(id);
    for (let hops = 0; at?.where_ref && hops < MAX_HOPS; hops++) {
      if (at.where_tpl !== "same" && at.where_tpl !== "at") return undefined;
      if (own[at.where_ref]) return at.where_ref;
      at = byId.get(at.where_ref);
    }
    return undefined;
  };
  const out: Record<string, PlaceLife> = {};
  for (const p of places) {
    if (own[p.id]) continue;
    const town = townOf(p.id);
    const of = town ? own[town] : undefined;
    if (!town || !of || (!of.gap && !of.until)) continue;
    const townRu = ruName(town) ?? byId.get(town)?.name ?? "";
    const townEn = byId.get(town)?.name ?? "";
    const sameName = (ruName(p.id) ?? p.name) === townRu;
    out[p.id] = {
      ...(of.until ? { until: of.until } : {}),
      ...(of.gap ? { gap: of.gap } : {}),
      note: sameName
        ? of.note
        : { en: `${townEn}: ${of.note.en ?? ""}`, ru: `${townRu}: ${of.note.ru ?? ""}` },
      sources: of.sources,
      ...(of.sources_ru ? { sources_ru: of.sources_ru } : {}),
      inherited: true,
    };
  }
  return out;
}
