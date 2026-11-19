"""Step 7: the wave's content file, content/ancient-sites-wave<WAVE>.json: names no other place
on the map has, in every language Wikidata gives a fitting one, and years fixed by hand where
the periods cannot give them.

    WAVE=2 python3 -E -s -m pipeline.ancient.assemble <work>

Run after `pnpm data`: the names already taken are read from the built map.
"""

from __future__ import annotations

import collections
import glob
import json
import os
import pathlib
import re
import sys

from pipeline.ancient.common import ROOT, read

# Corrections by hand (content/ancient-wave-corrections.json, checked by the content build):
# labels left out, years the periods cannot give, English labels, names and kinds.
_FIXES = json.loads((ROOT / "content/ancient-wave-corrections.json").read_text(encoding="utf-8"))
# Moved away, or not the ancient place the item is about.
MOVED = re.compile("|".join(_FIXES["left_out"]), re.I)
# Years the periods cannot give, astronomical: (from or None, to, why).
FIX = {y["site"]: (y.get("from"), y["to"], y["why"]) for y in _FIXES["years"]}
RENAME: dict[str, str] = _FIXES["renamed"]
NAME = {(n["site"], n["lang"]): n["name"] for n in _FIXES["names"]}
NO_NAME = {site: set(langs) for site, langs in _FIXES["no_names"].items()}
KIND: dict[str, str] = _FIXES["kinds"]

CYRILLIC = ("ru", "uk", "bg", "sr")
# Cyrillic names where Wikidata has none: ours, as that language's classical scholarship
# writes the place or sound for sound; a Wikidata label wins.
OUR_CYRILLIC = json.loads((ROOT / "pipeline/ancient/names-cyrillic.json").read_text(encoding="utf-8"))
SOURCE = (
    "Ancient sites, wave {wave}: Pleiades (CC BY 3.0) settlements, sanctuaries and ports linked to a Wikidata "
    "item (CC0) that is an ancient site, not a modern town; point from Pleiades; years the span of the periods "
    "Pleiades attests (modern ones left out), so approximate; names from Wikidata labels (in Russian, Ukrainian, "
    "Bulgarian and Serbian, where Wikidata has none, ours: pipeline/ancient/names-cyrillic.json), none that "
    "another place on the map already has. Written by a script; see docs/adr/0018."
)


def clean(name: str) -> str:
    return re.sub(r"\s*\([^)]*\)", "", name).strip()


def names_taken(wave: str) -> dict[str, set[str]]:
    """The names on the map, per language, which a new site never takes (Thebe near Troy as
    «Фивы»): the Bible's places, the first file and the other waves, and content/names-*.yaml."""
    taken: dict[str, set[str]] = collections.defaultdict(set)
    data = ROOT / "apps/web/public/data"
    for f in json.loads((data / "places.geojson").read_text(encoding="utf-8"))["features"]:
        taken["en"].add(f["properties"]["name"])
    for names in json.loads((data / "content.json").read_text(encoding="utf-8"))["names"].values():
        for lang, name in names.items():
            if isinstance(name, str):
                taken[lang].add(name)
    for s in json.loads((ROOT / "content/ancient-sites.json").read_text(encoding="utf-8"))["sites"]:
        taken["en"].add(s["en"])
        taken["ru"].add(s["ru"])
    for path in glob.glob(str(ROOT / "content/ancient-sites-wave*.json")):
        if path.endswith(f"wave{wave}.json"):
            continue
        for s in json.loads(pathlib.Path(path).read_text(encoding="utf-8"))["sites"]:
            taken["en"].add(s["en"])
            for lang, name in s.get("names", {}).items():
                taken[lang].add(name)
    for path in glob.glob(str(ROOT / "content/names-*.yaml")):
        lang = path.rsplit("-", 1)[1][:2]
        text = pathlib.Path(path).read_text(encoding="utf-8")
        for m in re.finditer(r'^\s+"?\d+"?:\s*"?([^"\n]+)"?\s*$', text, re.M):
            taken[lang].add(m.group(1))
    return taken


def names_of(site: dict, en: str, taken: dict[str, set[str]], dropped: collections.Counter) -> dict[str, str]:
    names = {}
    for lang, label in site["names"].items():
        if lang in NO_NAME.get(en, ()):
            continue
        name = clean(NAME.get((en, lang), label))
        # Wikidata's Serbian is now and then in Latin script; the map's Serbian is Cyrillic.
        if lang in CYRILLIC and re.search("[A-Za-z]", name):
            continue
        if name and name not in taken[lang] and name != en:
            names[lang] = name
        elif name in taken[lang]:
            dropped[f"name taken {lang}"] += 1
    for lang, name in OUR_CYRILLIC.get(site["id"], {}).items():
        if lang not in names and name not in taken[lang]:
            names[lang] = name
    return names


def main(work: pathlib.Path) -> None:
    wave = os.environ.get("WAVE", "1")
    taken = names_taken(wave)
    out, dropped = [], collections.Counter()
    for s in sorted(read(work, "wave.json"), key=lambda s: -s["fame"]):
        if MOVED.search(s["en"]):
            dropped["moved"] += 1
            continue
        en = clean(RENAME.get(s["en"], s["en"]))
        if en in taken["en"]:
            dropped["english name taken"] += 1
            continue
        names = names_of(s, en, taken, dropped)
        for lang, name in names.items():
            taken[lang].add(name)
        taken["en"].add(en)
        start, end = s["from_"], s["to"]
        fix = FIX.get(en)
        if fix:
            start, end = fix[0] if fix[0] is not None else start, fix[1]
        years = f"years: the span of the periods Pleiades attests it in ({s['periods']})" + (f"; by hand: {fix[2]}" if fix else "")
        out.append(
            {
                "id": s["id"],
                "en": en,
                **({"names": names} if names else {}),
                "lon": s["lon"],
                "lat": s["lat"],
                "from": start,
                "to": end,
                "approx": True,
                "kind": KIND.get(en, s["kind"]),
                "rank": 1 if s["fame"] >= 12 else 2,
                "sources": [f"https://pleiades.stoa.org/places/{s['id']}", f"https://www.wikidata.org/wiki/{s['qid']}", years],
            }
        )
    out.sort(key=lambda s: s["id"])
    path = ROOT / f"content/ancient-sites-wave{wave}.json"
    path.write_text(json.dumps({"_source": SOURCE.format(wave=wave), "sites": out}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(out), dict(dropped), collections.Counter(s["rank"] for s in out))


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
