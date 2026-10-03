import type { Locale } from "@hg/model";
import { DATA_URL } from "./data";

/** A person of the Bible (pipeline/people/package.py, from STEP Bible's TIPNR). */
export interface Person {
  /** TIPNR's unique name, stable between releases: "Aaron@Exo.4.14-Heb". */
  readonly id: string;
  readonly index: number;
  readonly name: string;
  /** The Synodal form, when it was read from the Russian text (content/people-ru.json). */
  readonly ru: string | null;
  readonly female: boolean;
  readonly fathers: readonly number[];
  readonly mothers: readonly number[];
  readonly spouses: readonly number[];
  readonly children: readonly number[];
  /** How many verses name them (TIPNR): Abraham 275, a king of Genesis 14 a handful. */
  readonly verses: number;
}

/** How a person is tied to a place: lived or acted there, or named there by TIPNR. */
export interface PlacePerson {
  readonly person: number;
  /** 0 central to the place's story, 1 supporting, 2 a local figure, 3 founder or resident. */
  readonly tier: number;
  /** The verse that ties them best, OSIS. */
  readonly verse: string;
}

export interface People {
  readonly people: readonly Person[];
  /** Place id → its people, most tied first. */
  readonly byPlace: ReadonlyMap<string, readonly PlacePerson[]>;
  /** Person index → the places they are tied to (place id, verse, tier), most tied first. */
  readonly placesOf: ReadonlyMap<
    number,
    readonly { readonly place: string; readonly verse: string; readonly tier: number }[]
  >;
  readonly credit: string;
}

type Row = [
  string,
  string,
  string | null,
  "m" | "f",
  number[],
  number[],
  number[],
  number[],
  number?,
];

let loaded: Promise<People> | null = null;
let ready: People | null = null;

/** people.json if it has already loaded: a card opens on its People tab without a flicker. */
export function peopleNow(): People | null {
  return ready;
}

/** people.json, fetched once, the first time a card asks for it (42 kB gzip). */
export function loadPeople(): Promise<People> {
  if (!loaded) {
    loaded = fetch(`${DATA_URL}/people.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`people: ${String(r.status)}`);
        return r.json() as Promise<{
          people: Row[];
          places: Record<string, [number, number, string][]>;
          credit: string;
        }>;
      })
      .then((raw) => {
        const people = raw.people.map(
          ([id, name, ru, g, fathers, mothers, spouses, children, verses], index): Person => ({
            id,
            index,
            name,
            ru,
            female: g === "f",
            fathers,
            mothers,
            spouses,
            children,
            verses: verses ?? 0,
          }),
        );
        const byPlace = new Map<string, PlacePerson[]>();
        const placesOf = new Map<number, { place: string; verse: string; tier: number }[]>();
        for (const [place, rows] of Object.entries(raw.places)) {
          byPlace.set(
            place,
            rows.map(([person, tier, verse]) => ({ person, tier, verse })),
          );
          for (const [person, tier, verse] of rows) {
            const list = placesOf.get(person) ?? [];
            list.push({ place, verse, tier });
            placesOf.set(person, list);
          }
        }
        for (const list of placesOf.values()) list.sort((a, b) => a.tier - b.tier);
        ready = { people, byPlace, placesOf, credit: raw.credit };
        return ready;
      });
    // A failed load is tried again next time.
    loaded.catch(() => {
      loaded = null;
    });
  }
  return loaded;
}

/** A person's name in the reader's language: the Synodal form in Russian when known. */
export function personName(p: Person, locale: Locale): string {
  return locale === "ru" && p.ru ? p.ru : p.name;
}
