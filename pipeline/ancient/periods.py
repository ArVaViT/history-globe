# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""Step 6: each site's years, the span of the periods Pleiades attests it in, modern ones left
out, narrowed by Wikidata's founding and end (wave/wave.json, rewritten).

    python3 -E -s -m pipeline.ancient.periods <work>
"""

from __future__ import annotations

import collections
import pathlib
import re
import sys

from pipeline.ancient.common import pleiades_places, read, write
from pipeline.ancient.periods_table import LATE, PERIODS
from pipeline.build_data import YEAR_MAX, YEAR_MIN

# An end up to this many years past the last period is taken from Wikidata, where Pleiades
# has not recorded a town's last years (Kamarina, burned by the Arabs in 853).
LATE_END_YEARS = 250
WIKIDATA_TIME = re.compile(r"([+-]?\d+)-[^|]*(?:\|(\d+))?")
PRECISION_YEAR = 9


def ancient_spans(periods: str, unknown: collections.Counter) -> list[tuple[int, int]]:
    """The spans of a place's periods (Pleiades' timePeriodsKeys), modern ones left out."""
    spans = []
    for p in (x.strip() for x in periods.split(",")):
        if not p or p.startswith(LATE) or "modern" in p:
            continue
        if p in PERIODS:
            spans.append(PERIODS[p])
        else:
            unknown[p] += 1
    return spans


def wikidata_year(value: str) -> int | None:
    """An astronomical year from the query service's "time|precision". A year before Christ
    held to the year comes astronomical already (753 BC is -0752), one held to a century as
    written (the 5th century BC is -0500): that one is moved."""
    m = WIKIDATA_TIME.match(value)
    if not m:
        return None
    year = int(m.group(1))
    return year + 1 if year < 0 and m.group(2) and int(m.group(2)) < PRECISION_YEAR else year


def narrowed(start: int, end: int, item: dict) -> tuple[int, int]:
    """Wikidata's founding or end, where it narrows the span: a site destroyed in the middle of
    a period (Glanum, 260) ends then. An earlier founding is left out, being often the
    district's, not the town's."""
    founded = max((y for t in item.get("P571", []) if (y := wikidata_year(t)) is not None), default=None)
    ended = min((y for t in item.get("P576", []) if (y := wikidata_year(t)) is not None), default=None)
    if founded is not None and start < founded < end:
        start = founded
    if ended is not None and start < ended <= min(end + LATE_END_YEARS, YEAR_MAX):
        end = ended
    return start, end


def main(work: pathlib.Path) -> None:
    sites = {s["id"]: s for s in read(work, "wave.json")}
    items = read(work, "wd.json")
    unknown, dropped, keep = collections.Counter(), collections.Counter(), []
    for r in pleiades_places(work):
        s = sites.get(r["id"])
        if not s:
            continue
        spans = ancient_spans(r["timePeriodsKeys"], unknown)
        if not spans:
            dropped["no ancient period"] += 1
            continue
        start = max(min(a for a, _ in spans), YEAR_MIN)
        end = min(max(b for _, b in spans), YEAR_MAX)
        if end < YEAR_MIN or start >= end:
            dropped["outside the map"] += 1
            continue
        s["from_"], s["to"] = narrowed(start, end, items.get(s["qid"], {}))
        s["periods"] = r["timePeriodsKeys"]
        keep.append(s)
    write(work, "wave.json", keep)
    print(len(keep), dict(dropped), "unknown periods:", unknown.most_common(60))
    print(collections.Counter((s["from_"], s["to"]) for s in keep).most_common(8))


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
