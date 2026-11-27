# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""Step 8: how well known each ancient place is, the Wikipedia articles (sitelinks) of its
Wikidata item where that item is the ancient place itself (an archaeological site, an ancient
city, a tell), not a modern town on it: Amman's articles are not Rabbah's. Writes
content/fame.json, which build_data.py ranks the Bible's places by and build-content.ts the
ancient sites.

The items come from the sources, not the built map, so the ranks never feed on themselves:
the Bible's towns from OpenBible with their checked items (content/wikidata.json), the ancient
sites from content/ancient-sites*.json.

    python3 -E -s -m pipeline.ancient.fame <work>
"""

from __future__ import annotations

import json
import pathlib
import sys

from pipeline.ancient.classes import ANC, MOD
from pipeline.ancient.common import ROOT, class_labels, content_sites, qid_of, values
from pipeline.build_data import fetch, place_kind
from pipeline.net import entity, sparql

OUT = ROOT / "content" / "fame.json"


def items_on_the_map() -> list[str]:
    checked = json.loads((ROOT / "content" / "wikidata.json").read_text(encoding="utf-8"))["places"]
    with fetch("openbible").open(encoding="utf-8") as f:
        towns = {checked[r["id"]] for r in map(json.loads, f) if place_kind(r.get("types")) == "settlement" and r["id"] in checked}
    return sorted(towns | {q for s in content_sites() if (q := qid_of(s))})


def main(work: pathlib.Path) -> None:
    qids = items_on_the_map()
    links: dict[str, int] = {}
    classes: dict[str, set[str]] = {}
    for v in values(qids):
        for b in sparql(f"SELECT ?i ?n ?c WHERE {{ VALUES ?i {{ {v} }} ?i wikibase:sitelinks ?n . OPTIONAL {{ ?i wdt:P31 ?c }} }}"):
            links[entity(b, "i")] = int(b["n"]["value"])
            if "c" in b:
                classes.setdefault(entity(b, "i"), set()).add(entity(b, "c"))
    labels = class_labels(work, {c for cs in classes.values() for c in cs})
    fame = {}
    for q, n in links.items():
        named = {labels.get(c, c) for c in classes.get(q, ())}
        if named & ANC and not any(MOD.search(k) for k in named if k not in ANC):
            fame[q] = n
    source = (
        "Wikipedia articles (sitelinks) of the Wikidata items (CC0) of the places on the map that "
        "are ancient sites, not modern towns. Written by pipeline/ancient/fame.py."
    )
    OUT.write_text(json.dumps({"_source": source, "items": dict(sorted(fame.items()))}, indent=2) + "\n", encoding="utf-8")
    print(len(qids), "items,", len(links), "with articles,", len(fame), "ancient")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
