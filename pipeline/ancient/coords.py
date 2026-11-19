"""Step 9: the sites' points against their Wikidata items' (P625), those more than 5 km apart
printed farthest first. Most are Wikidata's rough points or a disputed site; the rest are a
wrong pairing of Pleiades and Wikidata (Lycian Korykos as the Cilician city) or a wrong
point, fixed by hand.

    python3 -E -s -m pipeline.ancient.coords
"""

from __future__ import annotations

import re

from pipeline.ancient.common import content_sites, qid_of, values
from pipeline.geo import km
from pipeline.net import entity, sparql

APART_KM = 5
POINT = re.compile(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)")


def main() -> None:
    sites = content_sites()
    by_item: dict[str, list[dict]] = {}
    for s in sites:
        if q := qid_of(s):
            by_item.setdefault(q, []).append(s)
    points: dict[str, list[tuple[float, float]]] = {}
    for v in values(sorted(by_item)):
        for b in sparql(f"SELECT ?i ?c WHERE {{ VALUES ?i {{ {v} }} ?i wdt:P625 ?c }}"):
            if m := POINT.match(b["c"]["value"]):
                points.setdefault(entity(b, "i"), []).append((float(m.group(1)), float(m.group(2))))
    apart = []
    for q, ss in by_item.items():
        for s in ss:
            if q in points and (d := min(km((s["lon"], s["lat"]), c) for c in points[q])) > APART_KM:
                apart.append((round(d, 1), s["id"], s["en"], q, (s["lon"], s["lat"]), points[q][0]))
    apart.sort(reverse=True)
    print(len(sites), "sites,", len(points), "with P625,", len(apart), f"differ >{APART_KM} km")
    for row in apart:
        print(*row)


if __name__ == "__main__":
    main()
