"""People of the Bible for the app: apps/web/public/data/people.json, loaded on demand.

From the TIPNR build in pipeline/.cache/people (parse_tipnr.py, then build.py) and the
Synodal Russian names in content/people-ru.json. Kept: everyone tied to one of our places
or to someone in a family line. People are rows, referred to by index:

    {"people": [[id, name, ru | null, "m" | "f", father[], mother[], spouses[], children[],
                 verses], ...],
     "places": {place_id: [[person, tier, key verse], ...]},
     "credit": "..."}

Tiers: 0 core, 1 supporting, 2 local, 3 named by TIPNR (founder, people living there).
"""

import json
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CACHE = ROOT / "pipeline" / ".cache" / "people"
OUT = ROOT / "apps" / "web" / "public" / "data" / "people.json"
RU = ROOT / "content" / "people-ru.json"
TIERS = {"core": 0, "supporting": 1, "local": 2, "explicit": 3}
# Family links TIPNR gives that the text does not: no verse names David's mother (2 Sam
# 17:25 makes Abigail a daughter of Nahash, which some read as Jesse's wife).
NOT_IN_TEXT_FILE = ROOT / "content" / "people-not-in-text.json"
# The same reading made Nahash the mother of all Jesse's sons: the text names only Abigail
# as Nahash's daughter (2 Sam 17:25).
ONLY_CHILDREN = {"Nahash@2Sa.17.25": ("Abigail@",)}
# TIPNR names Jacob by the name he was given (Gen 32:28), which is also the nation's: the
# story's reader looks for Jacob.
ENGLISH_NAME = {"Israel@Gen.25.26-Rev": "Jacob"}


def unnamed(pid: str) -> bool:
    """TIPNR's records for people the text does not name: "daughter_of_Lot", "Jerusalem_wives"."""
    base = pid.split("@")[0]
    return base[:1].islower() or base.endswith(("_wives", "_woman"))


PER_PLACE = 12

# TIPNR's book abbreviations in canonical order, for "where the text first names them".
BOOK_ORDER = (
    "Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng "
    "Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act "
    "Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev"
).split()


def first_named(pid: str) -> tuple[int, int, int, str]:
    """The verse in a TIPNR id ("Shem@Gen.5.32") as a sortable key; unknown ones last."""
    ref = pid.split("@", 1)[1].split("-")[0] if "@" in pid else ""
    parts = ref.split(".")
    try:
        # Some verses carry a letter ("2Ch.23.1a"): the number orders them.
        verse = int(re.match(r"\d+", parts[2]).group())  # type: ignore[union-attr]
        return (BOOK_ORDER.index(parts[0]), int(parts[1]), verse, pid)
    except (ValueError, IndexError, AttributeError):
        return (len(BOOK_ORDER), 0, 0, pid)


def main() -> None:
    people = json.loads((CACHE / "tipnr-people.json").read_text())["people"]
    by_place = json.loads((CACHE / "place-people.json").read_text())["places"]
    ru_names = json.loads(RU.read_text())["names"] if RU.exists() else {}
    by_id = {p["id"]: p for p in people}

    def ids(field: list[dict] | None, owner: str = "", role: str = "") -> list[str]:
        # Links TIPNR marks uncertain ("?") stay out, as do the unnamed.
        return [
            r["id"]
            for r in field or []
            if r.get("resolved")
            and r["id"] in by_id
            and "?" not in r.get("flags", [])
            and not unnamed(r["id"])
        ]

    # Ties of a person to a place their key verse does not bear out (John the Baptist in
    # Galilee by Matt 4:12, which is about Jesus): content/people-places-not-in-text.json.
    off_file = ROOT / "content" / "people-places-not-in-text.json"
    off_data = json.loads(off_file.read_text()) if off_file.exists() else {}
    off = {(x["person"], x["place"]) for x in off_data.get("ties", [])}
    # And where they were, the verse that shows it, when TIPNR's does not.
    better = {(x["person"], x["place"]): x["verse"] for x in off_data.get("verses", [])}
    keep: set[str] = set()
    for place_id, entry in by_place.items():
        # The same people the places will show: ties the text does not bear out left out first.
        keep.update(
            [t["person"] for t in entry["top"] if (t["person"], place_id) not in off][:PER_PLACE]
        )
    for p in people:
        if p.get("anonymous"):
            continue
        family = ids(p.get("father")) + ids(p.get("mother")) + ids(p.get("partners")) + ids(p.get("offspring"))
        if family:
            keep.add(p["id"])
    keep = {k for k in keep if k in by_id and not by_id[k].get("anonymous") and not unnamed(k)}
    order = sorted(keep)
    index = {pid: i for i, pid in enumerate(order)}

    # Family links from both sides: TIPNR sometimes records a parent on the child but not
    # the child on the parent (Rahab and Boaz). A link the text does not make is dropped
    # from both sides.
    fathers: dict[str, set[str]] = {pid: set() for pid in order}
    mothers: dict[str, set[str]] = {pid: set() for pid in order}
    spouses: dict[str, set[str]] = {pid: set() for pid in order}
    for pid in order:
        p = by_id[pid]
        for f in ids(p.get("father"), pid, "father"):
            if f in index:
                fathers[pid].add(f)
        for m in ids(p.get("mother"), pid, "mother"):
            if m in index:
                mothers[pid].add(m)
        for s in ids(p.get("partners"), pid, "partners"):
            if s in index:
                spouses[pid].add(s)
                spouses[s].add(pid)
        role = "mother" if p.get("gender") == "female" else "father"
        for c in ids(p.get("offspring"), pid, "offspring"):
            if c in index:
                (mothers if role == "mother" else fathers)[c].add(pid)
    # Links the text does not make (content/people-not-in-text.json), dropped after both
    # sides have been read, so neither side brings them back.
    drops = json.loads(NOT_IN_TEXT_FILE.read_text())["links"] if NOT_IN_TEXT_FILE.exists() else []
    for d in drops:
        who, other = d["person"], d["other"]
        if who not in index or other not in index:
            continue
        if d["role"] == "father":
            fathers[who].discard(other)
        elif d["role"] == "mother":
            mothers[who].discard(other)
        elif d["role"] == "spouse":
            spouses[who].discard(other)
            spouses[other].discard(who)
    # And links the text makes that TIPNR leaves out (content/people-links-in-text.json).
    adds_file = ROOT / "content" / "people-links-in-text.json"
    adds = json.loads(adds_file.read_text())["links"] if adds_file.exists() else []
    for a in adds:
        who, other = a["person"], a["other"]
        if who not in index or other not in index:
            continue
        {"father": fathers, "mother": mothers}.get(a["role"], spouses)[who].add(other)
        if a["role"] == "spouse":
            spouses[other].add(who)
    for c in order:
        for parent, allowed in ONLY_CHILDREN.items():
            if not c.startswith(allowed):
                fathers[c].discard(parent)
                mothers[c].discard(parent)
    children: dict[str, set[str]] = {pid: set() for pid in order}
    for c in order:
        for parent in fathers[c] | mothers[c]:
            children[parent].add(c)

    # Where TIPNR lists someone among a parent's offspring: the text's own order, for
    # those first named in one verse (Shem, Ham and Japheth, Gen 5:32).
    listed: dict[str, int] = {}
    for p in people:
        for k, o in enumerate(p.get("offspring") or []):
            listed.setdefault(o.get("id", ""), k)

    def sorted_refs(pids: set[str]) -> list[int]:
        # In the order the text first names them, not by name.
        def key(x: str) -> tuple[int, int, int, int, str]:
            b, c, v, pid = first_named(x)
            return (b, c, v, listed.get(x, 99), pid)

        return [index[x] for x in sorted(pids, key=key)]

    epithets_file = ROOT / "content" / "people-epithets.json"
    epithets = json.loads(epithets_file.read_text())["names"] if epithets_file.exists() else {}
    rows = []
    for pid in order:
        p = by_id[pid]
        g = "f" if p.get("gender") == "female" else "m"
        rows.append(
            [
                pid,
                epithets.get(pid, {}).get("en") or ENGLISH_NAME.get(pid, p["name"]),
                epithets.get(pid, {}).get("ru") or ru_names.get(pid, {}).get("ru"),
                g,
                sorted_refs(fathers[pid]),
                sorted_refs(mothers[pid]),
                sorted_refs(spouses[pid]),
                sorted_refs(children[pid]),
                # How many verses name them: who carries the story, who is named once.
                len(p.get("refs") or []),
            ]
        )
    places = {}
    for place_id, entry in sorted(by_place.items()):
        row = [
            [
                index[t["person"]],
                TIERS.get(t["tier"], 1),
                better.get((t["person"], place_id), (t.get("key_verses") or [""])[0]),
            ]
            for t in [
                t for t in entry["top"] if t["person"] in index and (t["person"], place_id) not in off
            ][:PER_PLACE]
        ]
        if row:
            places[place_id] = row
    OUT.write_text(
        json.dumps(
            {
                "credit": "People and family links: STEP Bible TIPNR (www.STEPBible.org), CC BY 4.0; "
                "matched to places and filtered (pipeline/people).",
                "people": rows,
                "places": places,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    named = sum(1 for r in rows if r[2])
    print(f"people: {len(rows)} people ({named} with a Russian name), {len(places)} places")


if __name__ == "__main__":
    main()
