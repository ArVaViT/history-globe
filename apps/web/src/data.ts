import { NT_FROM, type PlaceInfo, type Tour } from "@hg/core";
import type { ContentRelease } from "@hg/model";
import type { FeatureCollection, Point } from "geojson";

export interface PlaceProps {
  readonly id: string;
  readonly name: string;
  readonly name_ru?: string;
  /** Verse where the Synodal Russian name was read. */
  readonly name_ru_osis?: string;
  readonly kind: string;
  readonly sites: number;
  readonly verses: number;
  readonly nt: number;
  readonly ot: number;
  readonly rank: number;
  readonly where: string;
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
    const props: PlaceProps = entry
      ? { ...f.properties, name_ru: entry.ru, ...(entry.osis ? { name_ru_osis: entry.osis } : {}) }
      : f.properties;
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
  return { places, byId, tours, sites };
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
    if (prefix || inside) scored.push({ props, score: (prefix ? 0 : 10) + props.rank });
  }
  return scored
    .sort((a, b) => a.score - b.score || b.props.verses - a.props.verses)
    .slice(0, limit);
}
