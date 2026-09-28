"""Build the map data for apps/web from dated snapshots of allowlisted datasets.

Stdlib only for now (ADR 0005 moves this to uv + DuckDB/GeoPandas once tiles need it).
Every dataset is checked against the licence allowlist (ADR 0008) and recorded with its
snapshot date and hash in the output manifest.

Usage: python3 pipeline/build_data.py
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import time
import urllib.error
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".cache"
OUT = ROOT / "apps" / "web" / "public" / "data"

ALLOWED_LICENSES = {"CC0-1.0", "PD", "CC-BY-3.0", "CC-BY-4.0", "ODC-BY-1.0"}

SOURCES = {
    "openbible": {
        "file": "openbible-ancient.jsonl",
        "url": "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl",
        "license": "CC-BY-4.0",
        "credit": "OpenBible.info Bible Geocoding Data, CC BY 4.0",
    },
    "cliopatria": {
        "file": "cliopatria_polities_only.geojson",
        "url": "https://github.com/Seshat-Global-History-Databank/cliopatria/raw/main/cliopatria.geojson.zip",
        "zip_member": "cliopatria_polities_only.geojson",
        "license": "CC-BY-4.0",
        "credit": "Cliopatria, Seshat Global History Databank, CC BY 4.0",
    },
    "wikidata_coords": {
        "file": "wikidata-coords.json",
        "url": "https://www.wikidata.org/w/api.php (wbgetentities, P625)",
        "license": "CC0-1.0",
        "credit": "Wikidata, CC0",
        "generated": True,
    },
    "natural_earth_ocean": {
        "file": "ne_50m_ocean.geojson",
        "url": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_ocean.geojson",
        "license": "PD",
        "credit": "Made with Natural Earth",
    },
    "natural_earth_lakes": {
        "file": "ne_50m_lakes.geojson",
        "url": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson",
        "license": "PD",
        "credit": "Made with Natural Earth",
    },
    "natural_earth_land": {
        "file": "ne_50m_land.geojson",
        "url": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson",
        "license": "PD",
        "credit": "Made with Natural Earth",
    },
}

# Region and period of the MVP (ADR 0005). West, south, east, north.
BBOX = (5.0, 12.0, 70.0, 48.0)
YEAR_MIN, YEAR_MAX = -2000, 200

# Tagged as lakes by Natural Earth, but created in the 20th century.
MODERN_LAKES = {"Lake Tharthar", "Razzaza Lake"}

TAG_RE = re.compile(r"<[^>]+>")

NT_BOOKS = {
    "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil",
    "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet",
    "2Pet", "1John", "2John", "3John", "Jude", "Rev",
}


def wikidata_get(url: str) -> dict:
    """GET from the Wikidata API politely: identify ourselves, pause, back off on 429."""
    req = urllib.request.Request(url, headers={"User-Agent": "history-globe-pipeline/0.1 (github.com/ArVaViT)"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req) as resp:
                time.sleep(1.0)
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = float(e.headers.get("Retry-After") or 5 * (attempt + 1))
            print(f"wikidata: 429, waiting {wait:.0f} s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def wikidata_coords(qids: list[str]) -> dict[str, list[float]]:
    """Coordinates (P625) for Wikidata items, cached. Wikidata is CC0 (ADR 0008)."""
    path = CACHE / SOURCES["wikidata_coords"]["file"]
    cache: dict[str, list[float] | None] = json.loads(path.read_text()) if path.exists() else {}
    missing = [q for q in qids if q not in cache]
    for i in range(0, len(missing), 50):
        batch = missing[i : i + 50]
        url = (
            "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids="
            + "|".join(batch)
        )
        entities = wikidata_get(url).get("entities", {})
        for q in batch:
            claims = entities.get(q, {}).get("claims", {}).get("P625", [])
            value = claims[0]["mainsnak"].get("datavalue", {}).get("value") if claims else None
            cache[q] = [round(value["longitude"], 5), round(value["latitude"], 5)] if value else None
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=0, sort_keys=True))
    return {q: c for q, c in cache.items() if c}


def wikidata_labels(qids: list[str], lang: str) -> dict[str, str]:
    """Labels of Wikidata items in one language, cached. CC0 (ADR 0008)."""
    path = CACHE / f"wikidata-labels-{lang}.json"
    cache: dict[str, str | None] = json.loads(path.read_text()) if path.exists() else {}
    missing = [q for q in qids if q not in cache]
    for i in range(0, len(missing), 50):
        batch = missing[i : i + 50]
        url = (
            "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels"
            f"&languages={lang}&ids=" + "|".join(batch)
        )
        entities = wikidata_get(url).get("entities", {})
        for q in batch:
            cache[q] = entities.get(q, {}).get("labels", {}).get(lang, {}).get("value")
        path.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True))
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True))
    return {q: v for q, v in cache.items() if v}


def qid(record: dict) -> str | None:
    for v in (record.get("linked_data") or {}).values():
        if isinstance(v, dict) and str(v.get("id", "")).startswith("Q"):
            return str(v["id"])
    return None


def fetch(name: str) -> pathlib.Path:
    src = SOURCES[name]
    if src["license"] not in ALLOWED_LICENSES:
        raise SystemExit(f"{name}: licence {src['license']} is not on the allowlist (ADR 0008)")
    path = CACHE / src["file"]
    if src.get("generated"):
        return path
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name} …")
        tmp = path.with_suffix(".download")
        urllib.request.urlretrieve(src["url"], tmp)
        if "zip_member" in src:
            with zipfile.ZipFile(tmp) as z:
                path.write_bytes(z.read(src["zip_member"]))
            tmp.unlink()
        else:
            tmp.rename(path)
    return path


def sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def in_bbox(xs: list[float], ys: list[float]) -> bool:
    return not (max(xs) < BBOX[0] or min(xs) > BBOX[2] or max(ys) < BBOX[1] or min(ys) > BBOX[3])


# --- places ------------------------------------------------------------------------


def osm_derived(resolution: dict) -> bool:
    """A point computed from an OSM polygon is ODbL-derived: excluded (ADR 0008)."""
    if resolution.get("lonlat_type") != "representative point":
        return False
    roles = resolution.get("geojson_roles", {})
    return any(isinstance(v, dict) and v.get("geometry_credit") == "osm" for v in roles.values())


def build_places() -> tuple[dict, dict]:
    records = [json.loads(line) for line in fetch("openbible").open(encoding="utf-8")]
    osm_qids = []
    for r in records:
        ids = r.get("identifications") or []
        res = next((x for x in (ids[0].get("resolutions", []) if ids else []) if x.get("lonlat")), None)
        if res is not None and osm_derived(res) and qid(r):
            osm_qids.append(qid(r))
    replacements = wikidata_coords([q for q in osm_qids if q])
    ru_labels = wikidata_labels([q for q in (qid(r) for r in records) if q], "ru")
    feats, excluded_osm, replaced, no_point = [], 0, 0, 0
    for r in records:
        ids = r.get("identifications") or []
        res = next((x for x in (ids[0].get("resolutions", []) if ids else []) if x.get("lonlat")), None)
        if res is None:
            no_point += 1
            continue
        coord_source = "openbible"
        if osm_derived(res):
            q = qid(r)
            if q and q in replacements:
                lon, lat = replacements[q]
                coord_source = "wikidata"
                replaced += 1
            else:
                excluded_osm += 1
                continue
        else:
            lon, lat = (float(v) for v in res["lonlat"].split(","))
        verses = r.get("verses", [])
        nt = sum(1 for v in verses if v["osis"].split(".")[0] in NT_BOOKS)
        name = r["friendly_id"]
        base = name.rsplit(" ", 1)[0] if name.rsplit(" ", 1)[-1].isdigit() else name
        feats.append({
            "type": "Feature",
            "id": len(feats),
            "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
            "properties": {
                "id": r["id"],
                "name": base,
                "kind": (r.get("types") or ["place"])[0],
                "sites": len(ids),
                "verses": len(verses),
                "nt": nt,
                "ot": len(verses) - nt,
                # 0 = most important. Used for label priority and zoom thresholds.
                "rank": 0 if len(verses) >= 40 else 1 if len(verses) >= 10 else 2 if len(verses) >= 3 else 3,
                "where": TAG_RE.sub("", ids[0].get("description", "")),
                "osis": [v["osis"] for v in verses[:12]],
                "coord": coord_source,
                # Russian label from Wikidata: a fallback, not checked against the Synodal
                # text. Verified Synodal names come from content/ and take precedence.
                **({"name_ru_wd": ru_labels[q]} if (q := qid(r)) and q in ru_labels else {}),
            },
        })
    stats = {
        "places": len(feats),
        "osm_points_replaced_from_wikidata": replaced,
        "excluded_osm_derived": excluded_osm,
        "without_point": no_point,
    }
    return {"type": "FeatureCollection", "features": feats}, stats


# --- polities ----------------------------------------------------------------------


def thin(ring: list[list[float]], eps: float = 0.02) -> list[list[float]] | None:
    out = [ring[0]]
    for x, y in ring[1:-1]:
        px, py = out[-1]
        if abs(x - px) > eps or abs(y - py) > eps:
            out.append([round(x, 4), round(y, 4)])
    out.append(ring[-1])
    return out if len(out) >= 4 else None


def ring_area_centroid(ring: list[list[float]]) -> tuple[float, float, float]:
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-12:
        return 0.0, ring[0][0], ring[0][1]
    return abs(a) / 2, cx / (3 * a), cy / (3 * a)


def point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            inside = not inside
    return inside


def point_in_polygon(x: float, y: float, poly: list[list[list[float]]]) -> bool:
    return point_in_ring(x, y, poly[0]) and not any(point_in_ring(x, y, h) for h in poly[1:])


LABEL_GRID_DEG = 8.0


def label_anchors(parts: list[list[list[list[float]]]]) -> list[tuple[float, float, float]]:
    """Several label points inside a polity, so a large empire is named wherever the
    reader looks, not only at its centroid. Returns (lon, lat, area of its part)."""
    anchors = []
    for poly in parts:
        area, cx, cy = ring_area_centroid(poly[0])
        if area < 0.05:
            continue
        if point_in_polygon(cx, cy, poly):
            anchors.append((cx, cy, area))
        xs = [p[0] for p in poly[0]]
        ys = [p[1] for p in poly[0]]
        gx = math.floor(min(xs) / LABEL_GRID_DEG) * LABEL_GRID_DEG + LABEL_GRID_DEG / 2
        while gx < max(xs):
            gy = math.floor(min(ys) / LABEL_GRID_DEG) * LABEL_GRID_DEG + LABEL_GRID_DEG / 2
            while gy < max(ys):
                if point_in_polygon(gx, gy, poly) and BBOX[0] <= gx <= BBOX[2] and BBOX[1] <= gy <= BBOX[3]:
                    anchors.append((gx, gy, area))
                gy += LABEL_GRID_DEG
            gx += LABEL_GRID_DEG
    return anchors


def build_polities() -> tuple[dict, dict, dict]:
    clio = json.loads(fetch("cliopatria").read_text(encoding="utf-8"))
    polys, labels = [], []
    names: dict[str, int] = {}
    for f in clio["features"]:
        p = f["properties"]
        if p["ToYear"] < YEAR_MIN or p["FromYear"] > YEAR_MAX or not f.get("geometry"):
            continue
        g = f["geometry"]
        parts = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        kept = [[r for r in (thin(ring) for ring in poly) if r] for poly in parts]
        kept = [k for k in kept if k]
        if not kept:
            continue
        xs = [pt[0] for k in kept for pt in k[0]]
        ys = [pt[1] for k in kept for pt in k[0]]
        if not in_bbox(xs, ys):
            continue
        name = p["Name"].strip("()")
        is_relation = p.get("Type") != "POLITY"
        color = names.setdefault(name, len(names) % 10)
        props = {
            "name": name,
            "y0": p["FromYear"],
            "y1": p["ToYear"] + 1,  # Cliopatria years are inclusive; ours are half-open.
            "rel": is_relation,
            "c": color,
        }
        polys.append({"type": "Feature", "geometry": {"type": "MultiPolygon", "coordinates": kept}, "properties": props})
        if not is_relation:
            total = sum(ring_area_centroid(k[0])[0] for k in kept)
            for lx, ly, _part in label_anchors(kept):
                labels.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [round(lx, 3), round(ly, 3)]},
                    # Bigger polities get labels earlier and larger.
                    "properties": {**props, "size": round(math.log10(max(total, 0.01)) + 2, 2)},
                })
    stats = {"polity_shapes": len(polys), "polity_names": len(names)}
    return (
        {"type": "FeatureCollection", "features": polys},
        {"type": "FeatureCollection", "features": labels},
        stats,
    )


# --- land and water ----------------------------------------------------------------


def build_land_water() -> tuple[dict, dict]:
    """Land and water from Natural Earth. Water is the ocean polygon plus natural lakes:
    a "world minus land" polygon triangulates badly on the globe, and modern reservoirs
    (Kakhovka, Tharthar, Nasser…) do not belong on a map of antiquity."""
    land = json.loads(fetch("natural_earth_land").read_text(encoding="utf-8"))
    ocean = json.loads(fetch("natural_earth_ocean").read_text(encoding="utf-8"))
    lakes = json.loads(fetch("natural_earth_lakes").read_text(encoding="utf-8"))
    natural = [
        f
        for f in lakes["features"]
        if f["properties"].get("featurecla") != "Reservoir" and f["properties"].get("name") not in MODERN_LAKES
    ]
    water = {"type": "FeatureCollection", "features": [*ocean["features"], *natural]}
    return land, water


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    places, place_stats = build_places()
    polities, polity_labels, polity_stats = build_polities()
    land, water = build_land_water()
    outputs = {
        "places.geojson": places,
        "polities.geojson": polities,
        "polity-labels.geojson": polity_labels,
        "land.geojson": land,
        "water.geojson": water,
    }
    for name, data in outputs.items():
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    manifest = {
        "schema_version": 1,
        "built_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "sources": {
            k: {
                "license": v["license"],
                "credit": v["credit"],
                "url": v["url"],
                "sha256": sha256(CACHE / v["file"]),
                "snapshot": dt.date.fromtimestamp((CACHE / v["file"]).stat().st_mtime).isoformat(),
            }
            for k, v in SOURCES.items()
        },
        "stats": {**place_stats, **polity_stats},
        "files": {name: (OUT / name).stat().st_size for name in outputs},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["stats"], ensure_ascii=False), {k: f"{v / 1e6:.1f} MB" for k, v in manifest["files"].items()})


if __name__ == "__main__":
    main()
