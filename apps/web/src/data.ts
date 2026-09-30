import { NT_FROM, type PlaceInfo, type Tour } from "@hg/core";
import type { ContentRelease, HistoryEvent, Locale, PlaceLife } from "@hg/model";
import type { FeatureCollection, Point } from "geojson";

export interface PlaceProps {
  readonly id: string;
  readonly name: string;
  readonly name_ru?: string;
  /** Verse where the Synodal Russian name was read. */
  readonly name_ru_osis?: string;
  readonly kind: string;
  readonly sites: number;
  /** The runner-up candidate site has at least 10 % of OpenBible's assessment. */
  readonly disputed: boolean;
  /** A second record of the same name on the same point: dot only, not listed twice. */
  readonly dup?: boolean;
  /** The same in Russian: another record on this point has the same Russian name. */
  readonly dup_ru?: boolean;
  /** First year the place stood, astronomical (content/place-life.yaml). */
  readonly life_from?: number;
  /** First year it no longer stood (half-open end). */
  readonly life_until?: number;
  /** Years in ruins between two lives, half-open [gap_from, gap_until). */
  readonly gap_from?: number;
  readonly gap_until?: number;
  /** Set when the place's own years are known (a curated record, not the city's). */
  readonly life_own?: boolean;
  readonly verses: number;
  readonly nt: number;
  readonly ot: number;
  readonly rank: number;
  readonly where: string;
  /** Russian "where it is today", when it names another place ("Вавилон, в радиусе 250 км"). */
  readonly where_ru?: string;
  /** Set when `where` is a template ("within 5 km of X"), not a modern name. */
  readonly where_tpl?: string;
  readonly osis: readonly string[];
  readonly coord: "openbible" | "wikidata";
}

/** A candidate location of a disputed place, with OpenBible's assessment in percent. */
export interface Site {
  readonly label: string;
  /** Russian label where the content build could write one ("то же место, что Авила"). */
  readonly labelRu?: string;
  /** null when OpenBible has rated none of the candidates. */
  readonly share: number | null;
  readonly at: readonly [number, number];
}

/** Named only in the New Testament, and the year is before its events: shown faded. */
export function beforeItsTime(
  place: Pick<
    PlaceProps,
    "ot" | "life_from" | "life_until" | "gap_from" | "gap_until" | "life_own"
  >,
  year: number,
): boolean {
  if (
    place.gap_from !== undefined &&
    year >= place.gap_from &&
    year < (place.gap_until ?? Infinity)
  )
    return true;
  if (year >= (place.life_until ?? Infinity)) return true;
  // A known founding year wins; a curated record without one means it stood before our
  // range; otherwise, named only in the New Testament → before 6 BC.
  if (place.life_from !== undefined) return year < place.life_from;
  if (place.life_own) return false;
  return place.ot === 0 && year < NT_FROM;
}

export interface LoadedData {
  readonly places: FeatureCollection<Point, PlaceProps>;
  readonly byId: ReadonlyMap<string, { readonly props: PlaceProps; readonly info: PlaceInfo }>;
  readonly tours: readonly (Tour & {
    readonly title: Readonly<Record<string, string>>;
    /** The year is a conventional point (debated chronology). */
    readonly approximate?: boolean;
  })[];
  /** Candidate locations per place id, most supported first. */
  readonly sites: ReadonlyMap<string, readonly Site[]>;
  /** Other records on the same point under another name (Babylon: Babylonia, Babel). */
  readonly alsoHere: Readonly<Record<Locale, ReadonlyMap<string, readonly string[]>>>;
  /** When places existed, with the note and sources (content/place-life.yaml). */
  readonly life: Readonly<Record<string, PlaceLife>>;
  /** Dated events of the history (content/events.yaml), in order. */
  readonly events: readonly HistoryEvent[];
}

// Under the app's base path, so it also works when served from a sub-path.
export const DATA_URL = `${import.meta.env.BASE_URL}data`;

type SiteProps = { place: string; label: string; label_ru?: string; share?: number };

export function groupSites(fc: FeatureCollection<Point, SiteProps>): Map<string, Site[]> {
  const sites = new Map<string, Site[]>();
  for (const f of fc.features) {
    const [lon = 0, lat = 0] = f.geometry.coordinates;
    const list = sites.get(f.properties.place) ?? [];
    const { label, label_ru: labelRu } = f.properties;
    list.push({
      label,
      ...(labelRu ? { labelRu } : {}),
      share: f.properties.share ?? null,
      at: [lon, lat],
    });
    sites.set(f.properties.place, list);
  }
  // Stable sort: unrated candidates keep OpenBible's order.
  for (const list of sites.values()) list.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  return sites;
}

/**
 * OpenBible keeps one location under several records: another name (Shinar for Babylon),
 * the region around a city, a namesake. For each place, the others on its exact point
 * whose name, in the given language, differs from its own and from those already listed,
 * most mentioned first.
 */
export function alsoHere(
  features: readonly { geometry: Point; properties: PlaceProps }[],
  locale: Locale,
): Map<string, string[]> {
  const shown = (p: PlaceProps) => (locale === "ru" ? (p.name_ru ?? p.name) : p.name);
  const byPoint = new Map<string, PlaceProps[]>();
  for (const f of features) {
    const key = f.geometry.coordinates.join(",");
    byPoint.set(key, [...(byPoint.get(key) ?? []), f.properties]);
  }
  const out = new Map<string, string[]>();
  for (const group of byPoint.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.verses - a.verses);
    for (const p of group) {
      const seen = new Set([shown(p)]);
      const others = sorted
        .filter((o) => {
          // In Russian, as on the map, a record without a Russian name is not listed:
          // an English "Beyond the River" among Сион and Иевус.
          if (locale === "ru" && o.name_ru === undefined) return false;
          if (seen.has(shown(o))) return false;
          seen.add(shown(o));
          return true;
        })
        .map((o) => o.id);
      if (others.length > 0) out.set(p.id, others);
    }
  }
  return out;
}

/**
 * Babylon, Babylonia and Babel share a point and the Russian name "Вавилон": only the most
 * mentioned keeps its label on the Russian map (`dup_ru`), as the pipeline does for
 * repeated English names (`dup`).
 */
export function markRussianDuplicates(
  features: { geometry: Point; properties: PlaceProps }[],
): Set<string> {
  const marked = new Set<string>();
  const best = new Map<string, PlaceProps>();
  for (const f of features) {
    const { name_ru: ru } = f.properties;
    // A record already hidden as an English duplicate never keeps the Russian label.
    if (!ru || f.properties.dup) continue;
    const key = `${f.geometry.coordinates.join(",")}|${ru}`;
    const kept = best.get(key);
    if (!kept) {
      best.set(key, f.properties);
      continue;
    }
    const [winner, loser] =
      kept.verses >= f.properties.verses ? [kept, f.properties] : [f.properties, kept];
    best.set(key, winner);
    const target = features.find((g) => g.properties === loser);
    if (target) {
      target.properties = { ...loser, dup_ru: true };
      marked.add(loser.id);
    }
  }
  return marked;
}

export async function loadData(): Promise<LoadedData> {
  const [places, content, siteFc] = await Promise.all([
    fetch(`${DATA_URL}/places.geojson`).then((r) => r.json() as Promise<LoadedData["places"]>),
    fetch(`${DATA_URL}/content.json`).then((r) => r.json() as Promise<ContentRelease>),
    fetch(`${DATA_URL}/sites.geojson`).then(
      (r) => r.json() as Promise<FeatureCollection<Point, SiteProps>>,
    ),
  ]);
  const sites = groupSites(siteFc);
  const byId = new Map<string, { props: PlaceProps; info: PlaceInfo }>();
  for (const f of places.features) {
    const entry = content.names[f.properties.id];
    const whereRu = content.where_ru?.[f.properties.id];
    const life = content.life?.[f.properties.id];
    const props: PlaceProps = {
      ...f.properties,
      ...(entry ? { name_ru: entry.ru, ...(entry.osis ? { name_ru_osis: entry.osis } : {}) } : {}),
      ...(whereRu ? { where_ru: whereRu } : {}),
      ...(life?.from ? { life_from: life.from.year } : {}),
      ...(life?.until ? { life_until: life.until.year + 1 } : {}),
      ...(life?.gap ? { gap_from: life.gap.from.year, gap_until: life.gap.until.year + 1 } : {}),
      ...(life && !life.inherited ? { life_own: true } : {}),
    };
    f.properties = props;
    const [lon = 0, lat = 0] = f.geometry.coordinates;
    byId.set(props.id, { props, info: { id: props.id, at: [lon, lat], kind: props.kind } });
  }
  const tours = content.tours.map((t) => ({
    id: t.id,
    year: t.year,
    ...(t.approximate ? { approximate: true } : {}),
    title: t.title,
    stops: t.stops.map((s) => ({
      placeId: s.place,
      at: byId.get(s.place)?.info.at ?? [0, 0],
      ref: s.ref,
      note: s.note,
    })),
  }));
  const marked = markRussianDuplicates(places.features);
  for (const f of places.features) {
    const entry = byId.get(f.properties.id);
    if (entry && marked.has(f.properties.id))
      byId.set(f.properties.id, { ...entry, props: f.properties });
  }
  const here = {
    ru: alsoHere(places.features, "ru"),
    en: alsoHere(places.features, "en"),
    uk: alsoHere(places.features, "ru"),
    de: alsoHere(places.features, "en"),
  };
  return {
    places,
    byId,
    tours,
    sites,
    alsoHere: here,
    life: content.life ?? {},
    events: content.events ?? [],
  };
}

/**
 * A name as the search compares it: lower case, "ё" as "е", no accents ("Ḥ", "é"), and
 * no hyphens, apostrophes or spaces, so "беф шемеш" finds "Беф-Шемеш".
 */
export function foldName(s: string): string {
  return s
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .replace(/[\s\-\u2010-\u2015'\u2019\u02bc]+/g, "");
}

/** Search by English or Russian name; exact prefix first, then by importance. */
export function searchPlaces(
  data: LoadedData,
  query: string,
  limit = 8,
): { readonly props: PlaceProps }[] {
  if (query.trim().length < 2) return [];
  const q = foldName(query);
  if (q.length === 0) return [];
  const scored: { props: PlaceProps; score: number }[] = [];
  for (const { props } of data.byId.values()) {
    const names = [props.name, props.name_ru ?? ""].map(foldName);
    const prefix = names.some((n) => n.startsWith(q));
    const inside = !prefix && names.some((n) => n.includes(q));
    // The modern name ("Tell Hum" for Capernaum) also finds a place, after its own names.
    const today =
      !prefix && !inside && props.where_tpl === undefined && foldName(props.where).includes(q);
    if (prefix || inside || today)
      scored.push({ props, score: (prefix ? 0 : inside ? 10 : 20) + props.rank });
  }
  return scored
    .sort((a, b) => a.score - b.score || b.props.verses - a.props.verses)
    .slice(0, limit);
}
