// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { PlaceLife } from "./content.ts";

/** What the link resolution needs of a place (places.geojson properties). */
export interface LinkedPlace {
  readonly id: string;
  readonly name: string;
  /**
   * "same": another name of the place it refers to; "at": inside it (a gate, a pool);
   * "same_name": the same place in other verses, followed only on the very same point.
   */
  readonly where_tpl?: string | undefined;
  readonly where_ref?: string | undefined;
  /** Where it is drawn, [lon, lat]: to tell a "same_name" record on the town's point. */
  readonly point?: readonly number[] | undefined;
}

const samePoint = (a?: readonly number[], b?: readonly number[]) =>
  a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];

const MAX_HOPS = 5;

/**
 * The years of places that have none of their own but are another name of a town, lie in
 * it, or are the town itself in other verses on its point (Ur of Gen 11:28, a record apart
 * from Ur the city), with an entry in place-life.yaml. Links are followed through chains (a gate of
 * Millo of Jerusalem) to the town with its own years; loops and other links give nothing.
 * Only the ruin and the end carry over, never the founding (Shamir of Judg 10:1, which
 * OpenBible places at Samaria, stood before Omri built Samaria), and the note in each language
 * is prefixed with the town's name in it once, unless the place bears that very name.
 */
export function inheritLife(
  places: readonly LinkedPlace[],
  own: Readonly<Record<string, PlaceLife>>,
  nameIn: (id: string, locale: string) => string | undefined,
): Record<string, PlaceLife> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const townOf = (id: string): string | undefined => {
    let at = byId.get(id);
    for (let hops = 0; at?.where_ref && hops < MAX_HOPS; hops++) {
      const next = byId.get(at.where_ref);
      const linked =
        at.where_tpl === "same" ||
        at.where_tpl === "at" ||
        (at.where_tpl === "same_name" && samePoint(at.point, next?.point));
      if (!linked) return undefined;
      if (own[at.where_ref]) return at.where_ref;
      at = next;
    }
    return undefined;
  };
  const out: Record<string, PlaceLife> = {};
  for (const p of places) {
    if (own[p.id]) continue;
    const town = townOf(p.id);
    const of = town ? own[town] : undefined;
    if (!town || !of || (!of.gap && !of.until)) continue;
    const townEn = byId.get(town)?.name ?? "";
    out[p.id] = {
      ...(of.until ? { until: of.until } : {}),
      ...(of.gap ? { gap: of.gap } : {}),
      note:
        p.name === townEn
          ? of.note
          : Object.fromEntries(
              Object.entries(of.note).map(([l, text]) => [
                l,
                `${nameIn(town, l) ?? townEn}: ${text}`,
              ]),
            ),
      sources: of.sources,
      ...(of.sources_ru ? { sources_ru: of.sources_ru } : {}),
      inherited: true,
    };
  }
  return out;
}

/**
 * The year a town in ruins stood again. A gap's `until` is its last year in ruins, as the
 * map draws it; a reader is told the year it was rebuilt, as the notes give it (Corinth
 * desolate "until Julius Caesar founded a Roman colony there in 44 BC": `until` 45 BC).
 */
export function rebuiltIn<Y extends { readonly year: number }>(gap: { readonly until: Y }): Y {
  return { ...gap.until, year: gap.until.year + 1 };
}
