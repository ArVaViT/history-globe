import { NT_FROM, type PlaceInfo, type Tour } from "@hg/core";
import type { ContentRelease, Locale } from "@hg/model";
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
export function beforeItsTime(place: Pick<PlaceProps, "ot">, year: number): boolean {
  return place.ot === 0 && year < NT_FROM;
}

export interface LoadedData {
  readonly places: FeatureCollection<Point, PlaceProps>;
  readonly byId: ReadonlyMap<string, { readonly props: PlaceProps; readonly info: PlaceInfo }>;
  readonly tours: readonly (Tour & { readonly title: Readonly<Record<string, string>> })[];
  /** Candidate locations per place id, most supported first. */
  readonly sites: ReadonlyMap<string, readonly Site[]>;
  /** Other records on the same point under another name (Babylon: Babylonia, Babel). */
  readonly alsoHere: Readonly<Record<Locale, ReadonlyMap<string, readonly string[]>>>;
}

export const DATA_URL = "/data";

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
    const props: PlaceProps = {
      ...f.properties,
      ...(entry ? { name_ru: entry.ru, ...(entry.osis ? { name_ru_osis: entry.osis } : {}) } : {}),
      ...(whereRu ? { where_ru: whereRu } : {}),
    };
    f.properties = props;
    const [lon = 0, lat = 0] = f.geometry.coordinates;
    byId.set(props.id, { props, info: { id: props.id, at: [lon, lat], kind: props.kind } });
  }
  const tours = content.tours.map((t) => ({
    id: t.id,
    year: t.year,
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
  return { places, byId, tours, sites, alsoHere: here };
}

/** Search by English or Russian name; exact prefix first, then by importance. */
export function searchPlaces(
  data: LoadedData,
  query: string,
  limit = 8,
): { readonly props: PlaceProps }[] {
  const q = query.trim().toLocaleLowerCase("ru");
  if (q.length < 2) return [];
  const scored: { props: PlaceProps; score: number }[] = [];
  for (const { props } of data.byId.values()) {
    const names = [props.name, props.name_ru ?? ""].map((n) => n.toLocaleLowerCase("ru"));
    const prefix = names.some((n) => n.startsWith(q));
    const inside = !prefix && names.some((n) => n.includes(q));
    // The modern name ("Tell Hum" for Capernaum) also finds a place, after its own names.
    const today =
      !prefix &&
      !inside &&
      props.where_tpl === undefined &&
      props.where.toLocaleLowerCase("ru").includes(q);
    if (prefix || inside || today)
      scored.push({ props, score: (prefix ? 0 : inside ? 10 : 20) + props.rank });
  }
  return scored
    .sort((a, b) => a.score - b.score || b.props.verses - a.props.verses)
    .slice(0, limit);
}
