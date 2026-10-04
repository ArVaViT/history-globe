import { escapeRegExp } from "@hg/model";
/**
 * Finding the places a text names with the index of scripts/build-text-places.ts (the one
 * public/hg-places.js uses on other sites): only names that point to one place, in all
 * their Russian cases. No imports: the place cards use it, and so do the static pages
 * (scripts/build-pages.ts).
 */
export interface TextPlaces {
  readonly pattern: RegExp;
  readonly forms: Readonly<Record<string, string>>;
  /** Forms that are also first names: left alone next to a capitalised word. */
  readonly names: ReadonlySet<string>;
}

export type Segment = { readonly text: string; readonly place?: string };

/** The index as the regular expression and lookups `splitPlaces` needs. */
export function textPlacesFrom(data: {
  forms: Readonly<Record<string, string>>;
  names?: readonly string[];
}): TextPlaces {
  const esc = escapeRegExp;
  // Longest first, so «Антиохию Писидийскую» wins over «Антиохию»; «е» matches «ё» too.
  const alts = Object.keys(data.forms)
    .sort((a, b) => b.length - a.length)
    .map((f) => esc(f).replace(/ /g, "\\s+").replace(/е/g, "[её]").replace(/['’]/g, "['’]"));
  return {
    // Whole words only, and not a part of a hyphenated name.
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}-])(?:${alts.join("|")})(?![\\p{L}\\p{N}]|-\\p{L})`,
      "gu",
    ),
    forms: data.forms,
    names: new Set(data.names ?? []),
  };
}

const key = (s: string) => s.replace(/\s+/g, " ").replace(/ё/g, "е").replace(/Ё/g, "Е");

/**
 * The text cut into plain runs and the places it names, each place once (its first
 * mention) and never one of `self`: the place whose card it is, and its other names on
 * the same point (Mount Zion's verse does not send the map to Zion, where it is).
 */
export function splitPlaces(
  text: string,
  index: TextPlaces,
  self: readonly string[] = [],
): Segment[] {
  const out: Segment[] = [];
  const seen = new Set<string>(self);
  let at = 0;
  for (const m of text.matchAll(index.pattern)) {
    const k = key(m[0]);
    const id =
      index.forms[k] ?? index.forms[k.replace(/'/g, "’")] ?? index.forms[k.replace(/’/g, "'")];
    if (!id || seen.has(id)) continue;
    const start = m.index;
    const after = text.slice(start + m[0].length);
    const before = text.slice(0, start);
    // "Jordan Peterson" is a person: a first name beside a capitalised word stays text.
    if (
      index.names.has(k) &&
      (/^\s+\p{Lu}/u.test(after) ||
        (/\p{Lu}\p{Ll}*\s+$/u.test(before) && !/(?:^|[.!?:—]\s*)\p{Lu}\p{Ll}*\s+$/u.test(before)))
    )
      continue;
    seen.add(id);
    if (start > at) out.push({ text: text.slice(at, start) });
    out.push({ text: m[0], place: id });
    at = start + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
