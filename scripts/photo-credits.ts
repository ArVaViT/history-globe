/**
 * The comparison behind scripts/check-photo-credits.ts: what a photo in content/photos.yaml
 * must say for the file's Wikimedia Commons metadata (the `extmetadata` of its image info).
 *
 * - The licence and its version are the ones Commons names (`LicenseShortName`), and the
 *   licence link is the one Commons gives (`LicenseUrl`), in its canonical form.
 * - Where Commons gives an attribution (`Attribution`: the credit the author asks for, as in
 *   "Uzi Paz Pikiwiki Israel"), the photo shows exactly that: in `credit`, or in `author`
 *   when it is only the name. A `credit` Commons does not ask for is refused.
 * - Otherwise a CC BY photo names the author Commons names (`Artist`). Our name may be the
 *   fuller one ("Kok Leng Yeo (yeowatzup)" for "yeowatzup"), and may leave out the place
 *   Flickr adds after it ("Vladislav Bezrukov from Walldorf, Germany").
 */

/** A photo as content/photos.yaml has it (the fields the comparison reads). */
export interface PhotoEntry {
  readonly place: string;
  readonly file: string;
  readonly author?: string | undefined;
  readonly credit?: string | undefined;
  readonly license: string;
  readonly license_url?: string | undefined;
}

/** The `extmetadata` of a Commons file: each field's value, HTML as Commons gives it. */
export type CommonsMeta = Readonly<Record<string, { readonly value?: unknown } | undefined>>;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Commons' HTML as plain text: no tags or entities, one space between words. */
export function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X"))
        return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** One field of the metadata as plain text ("" when Commons has none). */
export function field(meta: CommonsMeta, name: string): string {
  const value = meta[name]?.value;
  return typeof value === "string" ? plain(value) : "";
}

/** A licence link in one form: https, no "deed" page, a closing slash. */
export function canonicalLicenceUrl(url: string): string {
  return url
    .trim()
    .replace(/^http:\/\//, "https://")
    .replace(/deed(\.[a-z-]+)?$/i, "")
    .replace(/\/?$/, "/");
}

/** The author line Commons gives, without wiki user prefixes ("en:User:Adrianlw"). */
function commonsAuthor(meta: CommonsMeta): string {
  return field(meta, "Artist").replace(/(\b[a-z]{2,3}:)?User:/g, "");
}

/** The problems of one photo against its Commons metadata; none when it matches. */
export function compare(photo: PhotoEntry, meta: CommonsMeta): string[] {
  const problems: string[] = [];
  const at = `${photo.place} (${photo.file})`;

  const licence = field(meta, "LicenseShortName");
  const publicDomain = (l: string) => /^(public domain|pd\b)/i.test(l);
  if (
    licence !== photo.license &&
    !(publicDomain(licence) && photo.license === "Public domain") &&
    !(licence.startsWith("CC0") && photo.license.startsWith("CC0"))
  )
    problems.push(`${at}: licence "${photo.license}", Commons says "${licence}"`);
  const url = field(meta, "LicenseUrl");
  if (photo.license_url && url && canonicalLicenceUrl(url) !== photo.license_url)
    problems.push(`${at}: licence link ${photo.license_url}, Commons gives ${url}`);

  const shown = photo.credit ?? photo.author;
  const attribution = field(meta, "Attribution");
  if (attribution) {
    if (shown !== attribution)
      problems.push(
        `${at}: credit "${shown ?? ""}", the author asks for "${attribution}"` +
          (photo.author === attribution ? "" : ` (credit: "${attribution}")`),
      );
  } else if (photo.credit !== undefined)
    problems.push(`${at}: credit "${photo.credit}", but Commons asks for none; drop it`);
  if (photo.credit !== undefined && photo.credit === photo.author)
    problems.push(`${at}: credit repeats the author; drop it`);

  if (!attribution && photo.license.startsWith("CC BY")) {
    const artist = commonsAuthor(meta);
    const ours = photo.author ?? "";
    const named = ours.includes(artist) || artist.startsWith(`${ours} from `);
    if (!artist) problems.push(`${at}: Commons names no author for a CC BY photo`);
    else if (!named) problems.push(`${at}: author "${ours}", Commons names "${artist}"`);
  }
  return problems;
}
