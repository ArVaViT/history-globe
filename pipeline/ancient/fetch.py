"""Step 4: Wikidata's classes, labels in the site's languages, and founding and end dates of the
wave's candidates (wave/wd.json, kept between runs), and the English labels of those classes
(wave/classes.json).

    python3 -I pipeline/ancient/fetch.py <work>
"""

from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from ancient.common import class_labels, fame_floor, read, values, write  # noqa: E402
from build_dataset import LANGS  # noqa: E402
from net import entity, sparql  # noqa: E402


def stale(item: dict) -> bool:
    """Dates cached before they carried their precision ("time|precision") are asked again."""
    return any("|" not in v for k in ("P571", "P576") for v in item.get(k, []))


def main(work: pathlib.Path) -> None:
    candidates = [c for c in read(work, "candidates.json") if c["fame"] >= fame_floor()]
    path = work / "wave" / "wd.json"
    items: dict[str, dict] = {q: d for q, d in (read(work, "wd.json") if path.exists() else {}).items() if not stale(d)}
    asked = sorted({c["qid"] for c in candidates} - set(items))
    langs = ",".join(f'"{lang}"' for lang in LANGS)
    for v in values(asked):
        for b in sparql(f"SELECT ?i ?c WHERE {{ VALUES ?i {{ {v} }} ?i wdt:P31 ?c }}"):
            items.setdefault(entity(b, "i"), {}).setdefault("p31", []).append(entity(b, "c"))
        for b in sparql(f"SELECT ?i ?l WHERE {{ VALUES ?i {{ {v} }} ?i rdfs:label ?l FILTER(LANG(?l) IN ({langs})) }}"):
            items.setdefault(entity(b, "i"), {}).setdefault("labels", {})[b["l"]["xml:lang"]] = b["l"]["value"]
        # Founding and end with their precision (9 a year, 7 a century), the best-ranked
        # statements only, as wdt: gives them.
        for b in sparql(
            f"SELECT ?i ?p ?t ?pr WHERE {{ VALUES ?i {{ {v} }} "
            "VALUES (?p ?ps) { (wd:P571 psv:P571) (wd:P576 psv:P576) } ?p wikibase:claim ?st . "
            "?i ?st ?s . ?s a wikibase:BestRank ; ?ps ?n . ?n wikibase:timeValue ?t ; wikibase:timePrecision ?pr }"
        ):
            items.setdefault(entity(b, "i"), {}).setdefault(entity(b, "p"), []).append(f"{b['t']['value']}|{b['pr']['value']}")
    write(work, "wd.json", items)
    labels = class_labels(work, {c for d in items.values() for c in d.get("p31", [])})
    print(f"{len(asked)} items asked, {len(items)} known, {len(labels)} class labels")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
