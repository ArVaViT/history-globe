/**
 * content/tipnr.json: each place's record in STEPBible's TIPNR, from OpenBible's link
 * (ancient.jsonl, `linked_data`, source "tipnr") brought to the TIPNR the people build parsed
 * (pipeline/.cache/people/tipnr-parsed.json, `pnpm people`). OpenBible linked the 2021 TIPNR
 * by "Name@FirstVerse" without the "-LastBook" suffix TIPNR adds when a place is named in more
 * than one book, and TIPNR has since renamed records (Avva → Ivvah, Javan → Greece), merged
 * them (Bethul and Bethuel into Bethel@Jos.19.4-1Ch) or changed their first verse (Abdon:
 * Jos.21.30 → Jos.19.28). The link is followed by name and verse: a current record whose
 * unique name, or one of its alias forms ("Bethul|Bethel@Jos.19.4-1Ch"), carries the linked
 * name and whose verses include the linked one. Used for `tipnr` in api/v1/places.json and the
 * crosswalk (docs/crosswalk/places.csv). TIPNR and OpenBible's links are CC BY 4.0.
 *
 * Usage: node scripts/tipnr-links.ts  (after `pnpm data`)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const TIPNR = "s3b25cf"; // OpenBible's source id for TIPNR (data/source.jsonl)

/** STEPBible book abbreviations → OSIS (as pipeline/people/parse_tipnr.py). */
const STEP_TO_OSIS: Readonly<Record<string, string>> = {
  Gen: "Gen",
  Exo: "Exod",
  Lev: "Lev",
  Num: "Num",
  Deu: "Deut",
  Jos: "Josh",
  Jdg: "Judg",
  Rut: "Ruth",
  "1Sa": "1Sam",
  "2Sa": "2Sam",
  "1Ki": "1Kgs",
  "2Ki": "2Kgs",
  "1Ch": "1Chr",
  "2Ch": "2Chr",
  Ezr: "Ezra",
  Neh: "Neh",
  Est: "Esth",
  Job: "Job",
  Psa: "Ps",
  Pro: "Prov",
  Ecc: "Eccl",
  Sng: "Song",
  Isa: "Isa",
  Jer: "Jer",
  Lam: "Lam",
  Ezk: "Ezek",
  Eze: "Ezek",
  Dan: "Dan",
  Hos: "Hos",
  Jol: "Joel",
  Amo: "Amos",
  Oba: "Obad",
  Jon: "Jonah",
  Mic: "Mic",
  Nam: "Nah",
  Hab: "Hab",
  Zep: "Zeph",
  Hag: "Hag",
  Zec: "Zech",
  Mal: "Mal",
  Mat: "Matt",
  Mrk: "Mark",
  Luk: "Luke",
  Jhn: "John",
  Act: "Acts",
  Rom: "Rom",
  "1Co": "1Cor",
  "2Co": "2Cor",
  Gal: "Gal",
  Eph: "Eph",
  Php: "Phil",
  Col: "Col",
  "1Th": "1Thess",
  "2Th": "2Thess",
  "1Ti": "1Tim",
  "2Ti": "2Tim",
  Tit: "Titus",
  Phm: "Phlm",
  Heb: "Heb",
  Jas: "Jas",
  Jam: "Jas",
  "1Pe": "1Pet",
  "2Pe": "2Pet",
  "1Jn": "1John",
  "2Jn": "2John",
  "3Jn": "3John",
  Jud: "Jude",
  Rev: "Rev",
};

/**
 * Links that name and verse cannot follow, checked by hand on 2026-10-19
 * (docs/crosswalk/their-errors.md, O5): OpenBible's link goes to another record or to one
 * TIPNR no longer has as a place.
 */
const BY_HAND: Readonly<Record<string, string>> = {
  // Ham of Gen 14:5: OpenBible links Ammon@Deu.2.19; TIPNR has the town itself.
  a7a5f29: "Ham@Gen.14.5",
  // Perez-uzzah: OpenBible links the person Uzzah@2Sa.6.3; TIPNR's place record.
  ae67841: "Perez-uzza@1Ch.13.11",
  // Meronoth: TIPNR renamed Meronothite@1Ch.27.30 to the plural.
  a662bda: "Meronothites@1Ch.27.30-Neh",
  // Cuth: renamed Cuthah, first verse 2Ki.17.24.
  a538831: "Cuthah@2Ki.17.24-",
  // Kadesh of 2 Sam 24:6: TIPNR's record is named by the other reading, Tahtim-hodshi.
  adc9b5a: "Tahtim-hodshi@2Sa.24.6",
  // Dedan, Edom and Teman: OpenBible links the eponymous people (Dedan@Gen.10.7,
  // Esau@Gen.36.40, Teman@Gen.36.34), now person records; TIPNR's places carry our verses.
  a3a2a75: "Dedan@Isa.21.13-Ezk",
  a2735ff: "Edom@Gen.32.3-Mal",
  a831506: "Teman@Jer.49.7-Hab",
  // Links to another place (OpenBible errors, their-errors.md O5): Kir of Assyria (2 Kgs
  // 16:9, Amos 1:5) linked to Kir of Moab; Bethel of the Negeb (1 Sam 30:27) linked to the
  // Bethel of Jacob; Rimmon of the Negeb (Josh 15:32) linked to the Ain of Num 34:11, the
  // record TIPNR gives Zech 14:10 alone.
  ab92800: "Kir@2Ki.16.9-Amo",
  aeb5f24: "Bethel@Jos.19.4-1Ch",
  a8da370: "Rimmon@Jos.15.32-1Ch",
  // Ramah of the Negeb (Josh 19:8, "Baalath-beer, Ramah of the south"; one place with
  // Baalath-beer, content/place-points.json) linked to Ramah@Jos.18.25, the Ramah of Benjamin.
  // TIPNR itself files Josh.19.8 under that record, so name and verse would follow the link
  // there; the town's record is Baalath-beer@Jos.15.24-1Ch, which carries its other names
  // (Bealoth, Baal, Ramoth of 1 Sam 30:27). Checked 2026-10-23, their-errors.md O5.
  aaa4c6e: "Baalath-beer@Jos.15.24-1Ch",
};
const LEFT_OUT: Readonly<Record<string, string>> = {
  a88310a: "Beyond_the_River@Ezr.4.10 is no longer a TIPNR record",
};

interface TipnrRecord {
  kind: string;
  key: string;
  refs: string[];
  forms: { unique_name: string }[];
}
interface AncientRecord {
  id: string;
  friendly_id: string;
  linked_data?: { [source: string]: { id?: string } };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const toOsis = (ref: string) => {
  const m = /^([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)/.exec(ref);
  const [, book = "", chapter = "", verse = ""] = m ?? [];
  return m ? `${STEP_TO_OSIS[book] ?? book}.${chapter}.${verse}` : ref;
};

const records = (
  JSON.parse(
    readFileSync(join(root, "pipeline/.cache/people/tipnr-parsed.json"), "utf8"),
  ) as TipnrRecord[]
).filter((r) => r.kind.startsWith("PLACE"));
const byKey = new Map(records.map((r) => [r.key, r]));
// Every name a record answers to: its own and its alias forms ("Bethul|Bethel@Jos.19.4-1Ch").
const byName = new Map<string, Set<string>>();
for (const r of records) {
  const names = new Set([r.key.split("@")[0] ?? ""]);
  for (const f of r.forms) {
    const [alias] = (f.unique_name.split("@")[0] ?? "").split("|");
    if (alias) names.add(alias);
  }
  for (const n of names) {
    const set = byName.get(norm(n)) ?? new Set();
    set.add(r.key);
    byName.set(norm(n), set);
  }
}

/** The current unique name OpenBible's link means, or null when none fits by itself. */
function follow(link: string): string | null {
  if (byKey.has(link)) return link;
  const suffixed = [...byKey.keys()].filter((k) => k.startsWith(`${link}-`));
  if (suffixed.length === 1) return suffixed[0] ?? null;
  const [name = "", ref = ""] = link.split("@");
  const osis = toOsis(ref);
  const fits = [...(byName.get(norm(name)) ?? [])].filter((k) => byKey.get(k)?.refs.includes(osis));
  return fits.length === 1 ? (fits[0] ?? null) : null;
}

const places: Record<string, string> = {};
const changed: Record<string, string> = {};
const leftOut: Record<string, string> = {};
let unresolved = 0;
for (const line of readFileSync(join(root, "pipeline/.cache/openbible-ancient.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)) {
  const r = JSON.parse(line) as AncientRecord;
  const link = r.linked_data?.[TIPNR]?.id;
  if (!link) continue;
  const id = BY_HAND[r.id] ?? follow(link);
  if (!id) {
    leftOut[r.id] =
      LEFT_OUT[r.id] ?? `${link}: no current TIPNR place carries the name and the verse`;
    if (!LEFT_OUT[r.id]) unresolved += 1;
    continue;
  }
  if (!byKey.has(id)) throw new Error(`tipnr: ${r.id} → ${id} is not a TIPNR place record`);
  places[r.id] = id;
  if (id !== link && !id.startsWith(`${link}-`)) changed[r.id] = link;
}
const sorted = <T>(o: Record<string, T>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  join(root, "content/tipnr.json"),
  `${JSON.stringify(
    {
      _source:
        "STEPBible TIPNR unique names (Tyndale House Cambridge, www.STEPBible.org, CC BY 4.0) of OpenBible.info's ancient places, as OpenBible links them (Bible Geocoding Data, CC BY 4.0; a 2021 TIPNR, names without the book suffix), followed to the TIPNR of pipeline/.cache by name and verse where TIPNR has since renamed, merged or re-dated the record. `changed`: OpenBible's link where it is not that record's name (apart from the suffix); `left_out`: links no current TIPNR place answers to. Written by scripts/tipnr-links.ts.",
      places: sorted(places),
      changed: sorted(changed),
      left_out: sorted(leftOut),
    },
    null,
    2,
  )}\n`,
);
console.log(
  `tipnr: ${String(Object.keys(places).length)} places, ${String(Object.keys(changed).length)} links followed to a renamed or merged record, ${String(Object.keys(leftOut).length)} left out`,
);
if (unresolved) {
  console.error(`tipnr: ${String(unresolved)} links not followed and not listed in LEFT_OUT:`);
  for (const [id, why] of Object.entries(leftOut))
    if (!LEFT_OUT[id]) console.error(`  ${id}: ${why}`);
  process.exit(1);
}
