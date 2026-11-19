"""The years of content/ancient-sites.json, the sites chosen by hand before the waves, against
Wikidata's and Pleiades' (wave/audit.json): a site that ends long after Wikidata's end or
Pleiades' last period, or starts far from either, is listed to be read one by one.

    python3 -I pipeline/ancient/audit.py <work>
"""

from __future__ import annotations

import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from ancient.common import content_sites, pleiades_places, qid_of, values, write  # noqa: E402
from ancient.periods_table import LATE, PERIODS  # noqa: E402
from build_data import YEAR_MAX  # noqa: E402
from net import entity, sparql  # noqa: E402


def wikidata_years(qids: list[str]) -> dict[str, dict[str, list[int]]]:
    """Inception, dissolution, start and end time (P571, P576, P580, P582) of each item, as the
    query service writes them: astronomical when held to the year (periods.py moves a
    century's), which is close enough for a flag."""
    years: dict[str, dict[str, list[int]]] = {}
    for v in values(qids):
        for b in sparql(f"SELECT ?i ?p ?t WHERE {{ VALUES ?i {{ {v} }} VALUES ?p {{ wdt:P571 wdt:P576 wdt:P582 wdt:P580 }} ?i ?p ?t }}"):
            if m := re.match(r"([+-]?\d+)-", b["t"]["value"]):
                years.setdefault(entity(b, "i"), {}).setdefault(entity(b, "p"), []).append(int(m.group(1)))
    return years


def flags(site: dict, wd: dict[str, list[int]], periods: tuple[int, int] | None) -> list[str]:
    end = min(wd.get("P576", []) + wd.get("P582", []), default=None)
    start = min(wd.get("P571", []) + wd.get("P580", []), default=None)
    why = []
    if end is not None and site["to"] > end + 150 and site["to"] < YEAR_MAX:
        why.append(f"wd end {end}")
    if end is not None and site["to"] >= YEAR_MAX and end < 1150:
        why.append(f"wd end {end}")
    if start is not None and abs(site["from"] - start) > 400:
        why.append(f"wd start {start}")
    if periods and site["to"] > periods[1] + 400:
        why.append(f"pleiades last {periods[1]}")
    if periods and site["from"] < periods[0] - 800:
        why.append(f"pleiades first {periods[0]}")
    return why


def main(work: pathlib.Path) -> None:
    sites = content_sites(first_only=True)
    wd = wikidata_years(sorted({q for s in sites if (q := qid_of(s))}))
    ids = {s["id"] for s in sites}
    periods = {}
    for r in pleiades_places(work):
        if r["id"] in ids:
            keys = [p.strip() for p in r["timePeriodsKeys"].split(",")]
            spans = [PERIODS[p] for p in keys if p in PERIODS and not p.startswith(LATE)]
            if spans:
                periods[r["id"]] = (min(a for a, _ in spans), max(b for _, b in spans))
    out = []
    for s in sites:
        if why := flags(s, wd.get(qid_of(s) or "", {}), periods.get(s["id"])):
            out.append((s["id"], s["en"], s["from"], s["to"], "; ".join(why)))
    write(work, "audit.json", out)
    print(len(sites), "sites,", len(out), "to read")
    for row in out:
        print(*row, sep=" | ")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
