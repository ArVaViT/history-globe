# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""Step 3: the wave's candidates (wave/candidates.json). Pleiades' places with a precise point
inside the focus ellipse, settlements, sanctuaries and ports, linked to a Wikidata item, none
within 3 km of a place on the map, nor already a site or refused.

    python3 -E -s -m pipeline.ancient.candidates <work>
"""

from __future__ import annotations

import csv
import json
import pathlib
import sys

from pipeline.ancient.common import ROOT, content_sites, pleiades_places, qid_of, write
from pipeline.geo import km

KEEP = {"settlement", "sanctuary", "temple-2", "port", "temple"}
NEAR_KM = 3
# Checked and refused: Knidos at Burgaz, its first site (the Bible's Cnidus stands at Tekir,
# Acts 27:7); Kastri on Keos, which Wikidata's links make the Kastri of Syros; and Lycian
# Korykos, which they make the Cilician city.
REFUSED = {"570338", "638939", "599576"}


def in_focus(lon: float, lat: float) -> bool:
    """The focus of the map: an ellipse from Portugal to the Indus and from the Danube to Nubia."""
    return ((lon - 28) / 40.5) ** 2 + ((lat - 32) / 19.5) ** 2 <= 1


def best_items(work: pathlib.Path) -> dict[str, tuple[str, int]]:
    """Pleiades id → its Wikidata item with the most Wikipedia articles, and their number."""
    best: dict[str, tuple[str, int]] = {}
    with (work / "wd" / "pleiades-sitelinks.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            item, links = r["item"].rsplit("/", 1)[1], int(r["links"])
            if links > best.get(r["pid"], ("", -1))[1]:
                best[r["pid"]] = (item, links)
    return best


class Grid:
    """Points in 0.1° cells, to ask cheaply whether any lies within NEAR_KM of a point."""

    def __init__(self, points: list[list[float]]) -> None:
        self.cells: dict[tuple[int, int], list[list[float]]] = {}
        for p in points:
            self.cells.setdefault(self.cell(p), []).append(p)

    @staticmethod
    def cell(p: list[float]) -> tuple[int, int]:
        return int(p[0] * 10), int(p[1] * 10)

    def near(self, p: list[float]) -> bool:
        gx, gy = self.cell(p)
        return any(
            km(p, o) < NEAR_KM for dx in (-1, 0, 1) for dy in (-1, 0, 1) for o in self.cells.get((gx + dx, gy + dy), [])
        )


def main(work: pathlib.Path) -> None:
    fame = best_items(work)
    places = json.loads((ROOT / "apps/web/public/data/places.geojson").read_text(encoding="utf-8"))["features"]
    sites = content_sites()
    taken = {str(s["id"]) for s in sites}
    # An item already drawn never comes back through a second Pleiades place.
    used = {q for s in sites if (q := qid_of(s))}
    linked = {v["id"] for v in json.loads((ROOT / "content/pleiades.json").read_text(encoding="utf-8"))["places"].values()}
    grid = Grid(
        [f["geometry"]["coordinates"] for f in places if f["properties"]["kind"] == "settlement"]
        + [[s["lon"], s["lat"]] for s in sites]
    )
    out = []
    for r in pleiades_places(work):
        try:
            lat, lon = float(r["reprLat"]), float(r["reprLong"])
        except (ValueError, TypeError):  # no point given
            continue
        if r["locationPrecision"] != "precise" or not in_focus(lon, lat) or r["id"] not in fame:
            continue
        if r["id"] in taken or r["id"] in linked or r["id"] in REFUSED:
            continue
        types = {t.strip() for t in r["featureTypes"].split(",")}
        if not types & KEEP or grid.near([lon, lat]):
            continue
        item, links = fame[r["id"]]
        if item in used:
            continue
        out.append(
            {
                "pid": r["id"],
                "qid": item,
                "fame": links,
                "title": r["title"],
                "types": sorted(types),
                "lon": round(lon, 5),
                "lat": round(lat, 5),
                "min": r["minDate"],
                "max": r["maxDate"],
                "periods": r["timePeriodsKeys"],
            }
        )
    out.sort(key=lambda x: -x["fame"])
    write(work, "candidates.json", out)
    print({floor: sum(1 for x in out if x["fame"] >= floor) for floor in (3, 5, 8, 12, 20)})
    print(", ".join(f"{x['title']} ({x['fame']})" for x in out[:25]))


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
