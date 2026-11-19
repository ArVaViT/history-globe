"""Step 5: of the candidates, the ancient sites only, never a modern town, museum or castle; one
per 3 km, the better known (wave/wave.json).

    python3 -E -s -m pipeline.ancient.select <work>
"""

from __future__ import annotations

import collections
import pathlib
import re
import sys

from pipeline.ancient.classes import ANC, MOD
from pipeline.ancient.common import fame_floor, read, write
from pipeline.build_data import YEAR_MAX, YEAR_MIN
from pipeline.geo import km

SANCTUARY_TYPES = {"sanctuary", "temple-2", "temple"}
SANCTUARY_CLASSES = {
    "Egyptian temple", "ancient Greek temple", "hieron", "temple", "Roman temple", "Heraion", "oracle", "sanctuary",
    "Etruscan temple", "Asclepeion", "Necromanteion", "Romano-Celtic temple", "mithraeum",
}  # fmt: skip
NEAR_KM = 3


def astronomical(year: int) -> int:
    """Pleiades writes calendar years (-750 is 750 BC); the map counts astronomically."""
    return year + 1 if year < 0 else year


def english_name(label: str) -> str:
    name = re.sub(r"^(the )?(archaeological site of|ancient city of|site of)\s+", "", label, flags=re.I).strip()
    return name[0].upper() + name[1:]


def kind_of(types: set[str], classes: set[str]) -> str:
    if types & SANCTUARY_TYPES and "settlement" not in types or classes & SANCTUARY_CLASSES:
        return "sanctuary"
    if "port" in types or "ancient port" in classes:
        return "port"
    return "city" if "settlement" in types else "site"


def main(work: pathlib.Path) -> None:
    items, labels = read(work, "wd.json"), read(work, "classes.json")
    out, why = [], collections.Counter()
    for x in read(work, "candidates.json"):
        if x["fame"] < fame_floor():
            continue
        d = items.get(x["qid"], {})
        classes = {labels.get(k, k) for k in d.get("p31", [])}
        if not classes & ANC:
            why["not ancient"] += 1
            continue
        if any(MOD.search(k) for k in classes if k not in ANC):
            why["modern too"] += 1
            continue
        try:
            start, end = astronomical(int(float(x["min"]))), astronomical(int(float(x["max"])))
        except (ValueError, TypeError):
            why["no years"] += 1
            continue
        start, end = max(start, YEAR_MIN), min(end, YEAR_MAX)
        if start >= end:
            why["bad years"] += 1
            continue
        names = d.get("labels", {})
        en = english_name(names.get("en") or x["title"])
        if re.search(r"\d|\(|archaeolog", en, re.I):
            why["odd name"] += 1
            continue
        out.append(
            {
                "id": x["pid"],
                "en": en,
                "names": {k: v for k, v in names.items() if k != "en"},
                "lon": x["lon"],
                "lat": x["lat"],
                "from_": start,
                "to": end,
                "approx": True,
                "kind": kind_of(set(x["types"]), classes),
                "fame": x["fame"],
                "qid": x["qid"],
            }
        )
    kept: list[dict] = []
    for s in sorted(out, key=lambda s: -s["fame"]):
        if any(km((s["lon"], s["lat"]), (k["lon"], k["lat"])) < NEAR_KM for k in kept):
            why["near another"] += 1
            continue
        kept.append(s)
    write(work, "wave.json", kept)
    print(len(kept), dict(why), collections.Counter(s["kind"] for s in kept))
    print("ru", sum("ru" in s["names"] for s in kept), "fame>=45", sum(s["fame"] >= 45 for s in kept))
    print(", ".join(f"{s['en']}({s['fame']})" for s in kept[:40]))


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
