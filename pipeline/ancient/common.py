# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""What the wave scripts share: where things are, the content's sites, Wikidata's class labels.

A wave works in a directory outside the repository (`work`), which holds Pleiades' dumps and
the steps' files under `wave/`. The scripts run as modules of the pipeline package from the
repository root, without the environment's Python settings (`python3 -E -s -m`).
"""

from __future__ import annotations

import csv
import glob
import gzip
import json
import os
import pathlib
import re
from collections.abc import Iterator

from pipeline.net import entity, sparql

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

# Pleiades' places dump (pleiades-places-latest.csv.gz), saved under this name.
PLACES_CSV = "pleiades-dl/places.csv.gz"
QID = re.compile(r"wikidata\.org/wiki/(Q\d+)$")
# Wikidata's query service takes a few hundred items in one VALUES list.
BATCH = 200


def fame_floor() -> int:
    """The fewest Wikipedia articles an item of this wave has (FAME, 8 for the first wave)."""
    return int(os.environ.get("FAME", 8))


def read(work: pathlib.Path, name: str):
    return json.loads((work / "wave" / name).read_text(encoding="utf-8"))


def write(work: pathlib.Path, name: str, value: object) -> None:
    (work / "wave" / name).write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def pleiades_places(work: pathlib.Path) -> Iterator[dict]:
    csv.field_size_limit(10**9)  # a place's description runs long
    with gzip.open(work / PLACES_CSV, "rt", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def content_sites(first_only: bool = False) -> list[dict]:
    """The ancient sites of content/: the first file and the waves, in order."""
    files = sorted(glob.glob(str(ROOT / "content" / "ancient-sites*.json")))
    if first_only:
        files = [str(ROOT / "content" / "ancient-sites.json")]
    return [s for f in files for s in json.loads(pathlib.Path(f).read_text(encoding="utf-8"))["sites"]]


def qid_of(site: dict) -> str | None:
    """The Wikidata item a content site cites among its sources."""
    return next((m.group(1) for u in site["sources"] if (m := QID.search(u))), None)


def values(qids: list[str]) -> Iterator[str]:
    """The items as `VALUES` lists of one batch each: "wd:Q1 wd:Q2 …"."""
    for i in range(0, len(qids), BATCH):
        yield " ".join(f"wd:{q}" for q in qids[i : i + BATCH])


def class_labels(work: pathlib.Path, classes: set[str]) -> dict[str, str]:
    """English labels of Wikidata classes (P31 values), cached in wave/classes.json: those
    missing are asked for and added."""
    path = work / "wave" / "classes.json"
    labels = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for v in values(sorted(classes - set(labels))):
        for b in sparql(f'SELECT ?c ?l WHERE {{ VALUES ?c {{ {v} }} ?c rdfs:label ?l FILTER(LANG(?l)="en") }}'):
            labels[entity(b, "c")] = b["l"]["value"]
    path.write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")
    return labels
