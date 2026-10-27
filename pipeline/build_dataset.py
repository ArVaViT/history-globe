"""Build the Hugging Face dataset (huggingface.co/datasets/ArVaViT/history-globe) from a release.

Reads the open API and the map data that `pnpm data && pnpm content` write, and writes nine
CSV tables and the dataset card (pipeline/dataset_card.md, its counts filled in) to
pipeline/out/dataset/. The certainty columns (`identified_as`, `same_as`, `certainty`,
`confidence`, `candidate_sites`) and `place_sites` come from the map data, not from the API. Rows are sorted and runs of spaces folded, so no
canary mark (ADR 0017) reaches the tables. Only CC BY data goes in: the articles and the
answered questions (ADR 0016) never do.

Any fact the card states is counted here, and any check that fails stops the build with
exit code 1: a release that does not match the card is never written.

Usage: python3 pipeline/build_dataset.py [--published DIR]
  --published DIR   the dataset as published (e.g. `hf download`); when its tables are the
                    same as the new ones, the card keeps its snapshot date.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import filecmp
import json
import pathlib
import re
import string
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = ROOT / "apps" / "web" / "public" / "api" / "v1"
DATA = ROOT / "apps" / "web" / "public" / "data"
OUT = ROOT / "pipeline" / "out" / "dataset"
CARD = ROOT / "pipeline" / "dataset_card.md"

LANGS = ["en", "bg", "cs", "da", "de", "es", "fi", "fr", "hu", "it", "nb", "nl", "pl", "pt", "ro", "ru", "sr", "sv", "tl", "uk", "vi"]
OTHER = LANGS[1:]
TABLES = ["places", "place_verses", "place_sites", "people", "events", "battles", "tours", "tour_stops", "ancient_writers"]
# The card names these as places without a verse; the build checks that they still are.
NO_VERSE_EXAMPLES = ["Adasa", "Eridu", "Carthage", "Ur", "Magdala"]
MAX_SITES = 6
ORDER = (
    "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song "
    "Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom "
    "1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev"
).split()
RANK = {b: i for i, b in enumerate(ORDER)}
SNAPSHOT = re.compile(r"This is a snapshot of (\d{1,2} \w+ \d{4})\.")


def clean(s):
    return re.sub(r"\s+", " ", s).strip() if isinstance(s, str) else s


def year_label(y: int | None, approx: bool) -> str:
    """An astronomical year in words: -585 → "586 BC", 30 → "AD 30"."""
    if y is None:
        return ""
    text = f"{1 - y} BC" if y <= 0 else f"AD {y}"
    return ("c. " if approx else "") + text


def certainty(disputed: bool, confidence) -> str:
    """What the place card on the site says (methodology.html): 800+ settled, 600+ most likely."""
    if disputed:
        return "disputed"
    if confidence is None or confidence == "":
        return ""
    return "settled" if confidence >= 800 else "most likely" if confidence >= 600 else "tentative"


def ref_key(ref: str):
    b, c, v = (ref.split("-")[0].split(".") + ["0", "0"])[:3]
    return (RANK.get(b, 999), int(c), int(re.sub(r"\D", "", v) or 0))


def langs(prefix: str, m) -> dict:
    m = m or {}
    return {f"{prefix}_{lang}": clean(m.get(lang, "")) for lang in LANGS}


def renumber(site_rows: list[dict]) -> None:
    """Ranks without gaps within a place (a site whose point may not be shared is left out)."""
    last, n = None, 0
    for r in site_rows:
        n = n + 1 if r["place_id"] == last else 1
        r["rank"], last = n, r["place_id"]


def read(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build(api: pathlib.Path, data: pathlib.Path) -> tuple[dict[str, tuple[list[str], list[dict]]], dict, list[str]]:
    """The tables (name → columns, rows), the counts the card states, and the problems found."""
    problems: list[str] = []
    tables: dict[str, tuple[list[str], list[dict]]] = {}

    index = read(api / "index.json")
    places = read(api / "places.json")
    ids = {p["id"] for p in places}
    geo = {f["properties"]["id"]: f for f in read(data / "places.geojson")["features"]}
    sites = read(data / "sites.geojson")["features"]

    # The map data must be the same release as the API: the same places at the same points.
    if set(geo) != ids:
        problems.append(f"places.geojson and the API differ: {len(set(geo) ^ ids)} ids")
    for p in places:
        g = geo.get(p["id"])
        if g and [round(x, 5) for x in g["geometry"]["coordinates"]] != [round(p["lon"], 5), round(p["lat"], 5)]:
            problems.append(f"point differs for {p['id']}")
    found = {lang for p in places for lang in (p.get("names") or {})}
    if found != set(OTHER):
        problems.append(f"the languages of the names are not the card's: {sorted(found ^ set(OTHER))}")

    links = set()
    for book in index["books"]:
        for ref, pids in read(api / "verses" / f"{book}.json").items():
            for pid in pids:
                if pid not in ids:
                    problems.append(f"verse {ref} names unknown place {pid}")
                links.add((pid, ref))
    per_place = Counter(pid for pid, _ in links)
    for p in places:
        if per_place[p["id"]] != p["verses"]:
            problems.append(f"verse count differs for {p['id']}")

    place_rows = []
    for p in sorted(places, key=lambda p: (p["name"].lower(), p["id"])):
        g = geo[p["id"]]["properties"] if p["id"] in geo else {}
        page = (p.get("page") or {}).get("en")
        place_rows.append(
            {
                "id": p["id"],
                "name": p["name"],
                "kind": p["kind"],
                "lat": p["lat"],
                "lon": p["lon"],
                "identified_as": clean(g.get("where", "")),
                "same_as": g.get("where_ref", "") if g.get("where_tpl") in ("same", "same_name") else "",
                "certainty": certainty(bool(p.get("disputed")), g.get("confidence")),
                "disputed": bool(p.get("disputed")),
                "confidence": g.get("confidence", ""),
                "candidate_sites": g.get("sites", 0),
                "verse_count": p["verses"],
                "duplicate": bool(p.get("duplicate")),
                "wikidata": p.get("wikidata", ""),
                "pleiades": f"https://pleiades.stoa.org/places/{p['pleiades']}" if p.get("pleiades") else "",
                "tipnr": p.get("tipnr", ""),
                "url": f"https://historyglobe.app{page}" if page else f"https://historyglobe.app/?place={p['id']}",
                **{f"name_{lang}": clean((p.get("names") or {}).get(lang, "")) for lang in OTHER},
            }
        )
    tables["places"] = (list(place_rows[0]), place_rows)

    tables["place_verses"] = (
        ["place_id", "ref"],
        [{"place_id": a, "ref": b} for a, b in sorted(links, key=lambda x: (x[0], ref_key(x[1])))],
    )

    site_rows = []
    for f in sites:
        s = f["properties"]
        if s["place"] not in ids:
            problems.append(f"site for unknown place {s['place']}")
        site_rows.append(
            {
                "place_id": s["place"],
                "rank": s["rank"] + 1,
                "site": clean(s["label"]),
                "lat": f["geometry"]["coordinates"][1],
                "lon": f["geometry"]["coordinates"][0],
                "openbible_share": s.get("share", ""),
            }
        )
    site_rows.sort(key=lambda r: (r["place_id"], r["rank"]))
    renumber(site_rows)
    by_place = Counter(r["place_id"] for r in site_rows)
    if by_place and max(by_place.values()) > MAX_SITES:
        problems.append(f"a place has more than {MAX_SITES} proposed sites")
    for pid in by_place:
        shares = [r["openbible_share"] for r in site_rows if r["place_id"] == pid]
        if all(isinstance(x, (int, float)) for x in shares) and not 99 <= sum(shares) <= 101:
            problems.append(f"the shares of {pid} add up to {sum(shares)}")
    tables["place_sites"] = (list(site_rows[0]), site_rows)

    people = read(api / "people.json")
    person_ids = {x["id"] for x in people}
    people_rows = [
        {
            "id": x["id"],
            "name": x["name"],
            "sex": x["sex"],
            "verse_count": x["verses"],
            "first_ref": x["first"],
            **{f"name_{lang}": clean((x.get("names") or {}).get(lang, "")) for lang in OTHER},
        }
        for x in sorted(people, key=lambda x: (x["name"].lower(), x["id"]))
    ]
    tables["people"] = (["id", "name", "sex", "verse_count", "first_ref"] + [f"name_{lang}" for lang in OTHER], people_rows)

    events = read(api / "events.json")
    tables["events"] = (
        ["id", "year", "date", "approximate", "place_id", "ref"] + [f"title_{lang}" for lang in LANGS] + ["sources"],
        [
            {
                "id": e["id"],
                "year": e["year"],
                "date": year_label(e["year"], e.get("approximate")),
                "approximate": bool(e.get("approximate")),
                "place_id": e.get("place", ""),
                "ref": e.get("ref", ""),
                **langs("title", e["title"]),
                "sources": " | ".join(clean(s) for s in e.get("sources", [])),
            }
            for e in sorted(events, key=lambda e: (e["year"], e["id"]))
        ],
    )

    battles = read(api / "battles.json")
    tables["battles"] = (
        ["id", "year", "date", "approximate", "place_id", "ref"]
        + [f"{k}_{lang}" for k in ("title", "sides", "outcome") for lang in LANGS]
        + ["sources"],
        [
            {
                "id": b["id"],
                "year": b["year"],
                "date": year_label(b["year"], b.get("approximate")),
                "approximate": bool(b.get("approximate")),
                "place_id": b["place"],
                "ref": b.get("ref", ""),
                **langs("title", b["title"]),
                **langs("sides", b["sides"]),
                **langs("outcome", b["outcome"]),
                "sources": " | ".join(clean(s) for s in b.get("sources", [])),
            }
            for b in sorted(battles, key=lambda b: (b["year"], b["id"]))
        ],
    )

    tour_rows, stop_rows = [], []
    for t in sorted(read(api / "tours.json"), key=lambda t: (t["year"], t["id"])):
        tour_rows.append(
            {
                "id": t["id"],
                "year": t["year"],
                "date": year_label(t["year"], t["year"] < -999),
                "stops": len(t["stops"]),
                "people": " ".join(t.get("people", [])),
                **langs("title", t["title"]),
            }
        )
        for pid in t.get("people", []):
            if pid not in person_ids:
                problems.append(f"tour {t['id']} names unknown person {pid}")
        for n, s in enumerate(t["stops"], 1):  # the order of the stops is the route: not sorted
            sailed = s.get("sailed") or {}
            stop_rows.append(
                {
                    "tour_id": t["id"],
                    "stop": n,
                    "place_id": s["place"],
                    "ref": s.get("ref", ""),
                    "by": s.get("by", ""),
                    "days_sailed": sailed.get("days", ""),
                    "days_sailed_about": bool(sailed.get("about")) if sailed else "",
                    "days_sailed_ref": sailed.get("ref", ""),
                    **langs("note", s["note"]),
                }
            )
    tables["tours"] = (["id", "year", "date", "stops", "people"] + [f"title_{lang}" for lang in LANGS], tour_rows)
    tables["tour_stops"] = (
        ["tour_id", "stop", "place_id", "ref", "by", "days_sailed", "days_sailed_about", "days_sailed_ref"]
        + [f"note_{lang}" for lang in LANGS],
        stop_rows,
    )

    anc_rows = []
    for pid, items in read(api / "ancient.json").items():
        for a in items:
            anc_rows.append(
                {
                    "place_id": pid,
                    "author": clean(a["author"]["en"]),
                    "work": clean(a["work"]["en"]),
                    "passage": clean(a.get("passage", "")),
                    "url": a.get("url", ""),
                    **langs("note", a["note"]),
                }
            )
    anc_rows.sort(key=lambda r: (r["place_id"], r["author"], r["work"], r["passage"]))
    tables["ancient_writers"] = (["place_id", "author", "work", "passage", "url"] + [f"note_{lang}" for lang in LANGS], anc_rows)

    for r in place_rows:
        if r["same_as"] and r["same_as"] not in ids:
            problems.append(f"same_as of {r['id']} is unknown")
    for name in ("tour_stops", "ancient_writers", "place_sites"):
        for r in tables[name][1]:
            if r["place_id"] not in ids:
                problems.append(f"{name}: unknown place {r['place_id']}")
    for e in events + battles:
        if e.get("place") and e["place"] not in ids:
            problems.append(f"{e['id']}: unknown place {e['place']}")
    for name in NO_VERSE_EXAMPLES:
        if not any(r["name"] == name and r["verse_count"] == 0 for r in place_rows):
            problems.append(f"the card names {name} as a place without a verse; it is not one now")
    if sum(r["name"] == "Jericho" for r in place_rows) < 2:
        problems.append("the card speaks of two Jerichos")

    years = [e["year"] for e in events]
    counts = {
        **{t: f"{len(tables[t][1]):,}" for t in TABLES},
        "multi_site_places": f"{len(by_place):,}",
        "events_from": year_label(min(years), False),
        "events_to": year_label(max(years), False),
        "kinds": len({r["kind"] for r in place_rows}),
        "pages": f"{sum('/place/' in r['url'] for r in place_rows):,}",
        "unnamed_people": f"{sum(not any(r[f'name_{lang}'] for lang in OTHER) for r in people_rows):,}",
        "regions": f"{sum(r['kind'] == 'region' for r in place_rows):,}",
        "no_verse": f"{sum(r['verse_count'] == 0 for r in place_rows):,}",
        "languages": len(LANGS),
        "other_languages": len(OTHER),
        "api_built_at": index["built_at"],
    }
    return tables, counts, problems


def write_table(path: pathlib.Path, cols: list[str], rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="raise")
        w.writeheader()
        for r in rows:
            w.writerow({k: ("true" if v is True else "false" if v is False else v) for k, v in r.items()})


def snapshot_date(out: pathlib.Path, published: pathlib.Path | None) -> str:
    """Today, unless the published tables are the same as the new ones: then the published date."""
    today = f"{dt.date.today():%-d %B %Y}"
    if not published or not (published / "README.md").exists():
        return today
    same = all(
        (published / "data" / f"{t}.csv").exists()
        and filecmp.cmp(out / "data" / f"{t}.csv", published / "data" / f"{t}.csv", shallow=False)
        for t in TABLES
    )
    m = SNAPSHOT.search((published / "README.md").read_text(encoding="utf-8"))
    return m.group(1) if same and m else today


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--published", type=pathlib.Path)
    ap.add_argument("--out", type=pathlib.Path, default=OUT)
    args = ap.parse_args()

    if not (API / "index.json").exists():
        print("no API build: run `pnpm data && pnpm content` first", file=sys.stderr)
        return 1
    tables, counts, problems = build(API, DATA)
    if problems:
        print(f"{len(problems)} problems:", *problems[:20], sep="\n  ", file=sys.stderr)
        return 1

    (args.out / "data").mkdir(parents=True, exist_ok=True)
    for name, (cols, rows) in tables.items():
        write_table(args.out / "data" / f"{name}.csv", cols, rows)
        print(f"{name}: {len(rows)} rows, {len(cols)} columns")
    counts["snapshot"] = snapshot_date(args.out, args.published)
    card = string.Template(CARD.read_text(encoding="utf-8")).substitute(counts)
    (args.out / "README.md").write_text(card, encoding="utf-8")
    print(f"card: snapshot of {counts['snapshot']}; API built at {counts['api_built_at']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
