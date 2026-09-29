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
    # Modern locations behind each ancient point: read only to learn where a coordinate
    # came from, so that points copied from OSM or Google can be dropped (ADR 0008).
    "openbible_modern": {
        "file": "openbible-modern.jsonl",
        "url": "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/modern.jsonl",
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
    "natural_earth_rivers": {
        "file": "ne_10m_rivers.geojson",
        "url": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson",
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


# Coordinate origins we may not redistribute: OSM is ODbL, Google forbids extraction.
BANNED_COORD_SOURCES = {"osm", "osm_group", "google_maps", "google_books", "google_earth_community"}


def load_modern() -> dict[str, dict]:
    return {m["id"]: m for m in map(json.loads, fetch("openbible_modern").open(encoding="utf-8"))}


def lonlat_key(lonlat: str) -> tuple[float, ...]:
    return tuple(round(float(v), 5) for v in lonlat.split(","))


def source_banned(m: dict) -> bool:
    cs = m.get("coordinates_source") or {}
    return cs.get("type") in BANNED_COORD_SOURCES or cs.get("geometry_credit") == "osm"


def banned_lonlats(modern: dict[str, dict]) -> set[tuple[float, ...]]:
    """Coordinates OpenBible took from OSM or Google. Some locations without a source of
    their own repeat such a coordinate digit for digit: they are copies and banned too."""
    return {lonlat_key(m["lonlat"]) for m in modern.values() if m.get("lonlat") and source_banned(m)}


def coord_banned(resolution: dict, modern: dict[str, dict], banned: set[tuple[float, ...]]) -> bool:
    """True when the point is copied from, or computed from, OSM or Google (ADR 0008).

    Three ways in: the modern location's own coordinates were taken from OSM or Google;
    the point repeats such a coordinate exactly; or the point was computed (not copied from that location) while an OSM geometry
    is attached, i.e. it is a representative point or centre of an OSM polygon. An OSM
    outline next to a point that came from elsewhere does not taint the point.
    """
    basis = modern.get(resolution.get("modern_basis_id", "")) or {}
    if source_banned(basis) or lonlat_key(resolution["lonlat"]) in banned:
        return True
    roles = resolution.get("geojson_roles", {})
    osm_geometry = any(isinstance(v, dict) and v.get("geometry_credit") == "osm" for v in roles.values())
    return osm_geometry and resolution.get("lonlat") != basis.get("lonlat")


def first_point(ident: dict) -> dict | None:
    return next((x for x in ident.get("resolutions", []) if x.get("lonlat")), None)


def assert_no_banned_points(collections: dict[str, dict], modern: dict[str, dict]) -> None:
    """Independent licence lock (ADR 0008): no shipped point sits on a coordinate that
    OpenBible took from OSM or Google, whatever path the filters above let it through."""
    banned = banned_lonlats(modern)
    hits = [
        f"{name}: {f['properties'].get('id') or f['properties'].get('place')} at {f['geometry']['coordinates']}"
        for name, fc in collections.items()
        for f in fc["features"]
        if tuple(f["geometry"]["coordinates"]) in banned
    ]
    if hits:
        raise SystemExit("points copied from OSM or Google (ADR 0008):\n" + "\n".join(hits[:20]))


def where_props(label: dict) -> dict:
    extra = {f"where_{k}": label[k] for k in ("tpl", "ref", "ref_text", "n", "unit") if k in label}
    return {"where": label["label"], **extra}


def rank_of(weighted_mentions: int) -> int:
    return 0 if weighted_mentions >= 40 else 1 if weighted_mentions >= 10 else 2 if weighted_mentions >= 3 else 3


def build_places(
    records: list[dict], modern: dict[str, dict], sites_per_place: dict[str, tuple[int, bool]], river_places: set[str]
) -> tuple[dict, dict, list[str]]:
    def top_point(r: dict) -> dict | None:
        ids = r.get("identifications") or []
        return first_point(ids[0]) if ids else None

    banned = banned_lonlats(modern)
    banned_qids = [q for r in records if (res := top_point(r)) and coord_banned(res, modern, banned) and (q := qid(r))]
    replacements = wikidata_coords(banned_qids)
    feats, excluded, replaced, no_point = [], [], 0, 0
    for r in records:
        ids = r.get("identifications") or []
        res = top_point(r)
        if res is None:
            no_point += 1
            continue
        coord_source = "openbible"
        if coord_banned(res, modern, banned):
            q = qid(r)
            # A Wikidata coordinate identical to the banned one was copied from it: drop too.
            if q and q in replacements and tuple(replacements[q]) not in banned:
                lon, lat = replacements[q]
                coord_source = "wikidata"
                replaced += 1
            else:
                excluded.append(r["id"])
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
                # Candidate sites shipped in sites.geojson: 0 when fewer than two.
                "sites": sites_per_place.get(r["id"], (0, False))[0],
                "disputed": sites_per_place.get(r["id"], (0, False))[1],
                "verses": len(verses),
                "nt": nt,
                "ot": len(verses) - nt,
                # 0 = most important. Used for label priority and zoom thresholds. The New
                # Testament is about a third of the Old: its mentions weigh three times, so
                # Athens or Philippi are not ranked below a village named in two lists.
                "rank": rank_of(len(verses) - nt + 3 * nt),
                # Where it is today, as the best identification words it. "Same place as X"
                # says nothing a reader can use there: the card lists the candidates.
                **where_props(site_label(ids[0].get("description", ""), base)),
                "osis": [v["osis"] for v in verses[:12]],
                "coord": coord_source,
                # Drawn as a river line with its own label: no second label at the point.
                **({"line": True} if r["id"] in river_places else {}),
            },
        })
    # OpenBible splits one location into several records by referent (Bethel 1 and 2 on one
    # point). On the map they would print the same name twice: only the most mentioned of
    # each name at a point keeps its label; the others are marked `dup` and keep their dot.
    groups: dict[tuple, list[dict]] = {}
    for f in feats:
        groups.setdefault((*f["geometry"]["coordinates"], f["properties"]["name"]), []).append(f)
    duplicates = 0
    for group in groups.values():
        for f in sorted(group, key=lambda f: -f["properties"]["verses"])[1:]:
            f["properties"]["dup"] = True
            duplicates += 1
    stats = {
        "places": len(feats),
        "same_name_same_point_unlabelled": duplicates,
        "banned_points_replaced_from_wikidata": replaced,
        "excluded_banned_coordinates": len(excluded),
        "without_point": no_point,
    }
    return {"type": "FeatureCollection", "features": feats}, stats, excluded


# --- polities ----------------------------------------------------------------------


def thin(ring: list[list[float]], eps: float = 0.02) -> list[list[float]] | None:
    out = [ring[0]]
    for x, y in ring[1:-1]:
        px, py = out[-1]
        if abs(x - px) > eps or abs(y - py) > eps:
            out.append([round(x, COORD_DECIMALS), round(y, COORD_DECIMALS)])
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


LABEL_GRID_DEG = 6.0


def label_anchors(parts: list[list[list[list[float]]]]) -> list[tuple[float, float, float]]:
    """Several label points inside a polity, so a large empire is named wherever the
    reader looks, not only at its centroid. Returns (lon, lat, area of its part)."""
    anchors = []
    areas = [ring_area_centroid(poly[0])[0] for poly in parts]
    # Islands and scraps of a big empire get no label of their own: "Roman Empire" on
    # Crete, Cyprus and every Aegean island read as seven different states.
    floor = max(0.05, 0.1 * max(areas, default=0))
    for poly in parts:
        area, cx, cy = ring_area_centroid(poly[0])
        if area < floor:
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

    # Cliopatria sometimes carries two polities with the same shape and years
    # ("Phoenicia" / "Phoenician Empire"): drawn twice, they double the fill and the
    # labels. Keep one per shape and interval, preferring the shorter (base) name.
    def shape_key(f: dict) -> tuple[str, int, int]:
        geom = json.dumps(f["geometry"], sort_keys=True).encode()
        return hashlib.sha1(geom).hexdigest(), f["properties"]["FromYear"], f["properties"]["ToYear"]

    preferred: dict[tuple[str, int, int], str] = {}
    for f in clio["features"]:
        p = f["properties"]
        if p.get("Type") != "POLITY" or not f.get("geometry"):
            continue
        key, name = shape_key(f), p["Name"]
        if key not in preferred or (len(name), name) < (len(preferred[key]), preferred[key]):
            preferred[key] = name
    duplicates = 0

    # A composite polity ("(Phoenician Empire)" = Phoenicia + Phoenician Colonies) is
    # drawn over its own parts: double fill, two labels. Where a part is on the map in
    # the same years, draw the parts and leave the composite out.
    spans: dict[str, list[tuple[int, int]]] = {}
    for f in clio["features"]:
        p = f["properties"]
        if p.get("Type") == "POLITY" and f.get("geometry"):
            spans.setdefault(p["Name"], []).append((p["FromYear"], p["ToYear"]))

    def parts_on_map(p: dict) -> bool:
        return any(
            a <= p["ToYear"] and p["FromYear"] <= b
            for part in (p.get("Components") or "").split(";")
            if part
            for a, b in spans.get(part, [])
        )

    composites = 0

    for f in clio["features"]:
        p = f["properties"]
        if p["ToYear"] < YEAR_MIN or p["FromYear"] > YEAR_MAX or not f.get("geometry"):
            continue
        if p.get("Type") == "POLITY" and preferred.get(shape_key(f)) != p["Name"]:
            duplicates += 1
            continue
        if p.get("Type") == "POLITY" and parts_on_map(p):
            composites += 1
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
        # Cliopatria's years are already astronomical (ISO 8601): the data uses year 0
        # (e.g. Roman Empire ... 0 → 1 ...), so no BC/AD conversion is needed. Checked
        # 2026-09-29 against the 2026-05 release; its sampling is decades, not years.
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
    stats = {
        "polity_shapes": len(polys),
        "polity_names": len(names),
        "polity_duplicates_dropped": duplicates,
        "polity_composites_dropped": composites,
    }
    return (
        {"type": "FeatureCollection", "features": polys},
        {"type": "FeatureCollection", "features": labels},
        stats,
    )


# --- water ------------------------------------------------------------------------


def build_water() -> dict:
    """Water from Natural Earth: the ocean polygon plus natural lakes, drawn over a
    land-coloured globe (no land polygon needed). Modern reservoirs (Kakhovka, Tharthar,
    Nasser…) do not belong on a map of antiquity."""
    ocean = json.loads(fetch("natural_earth_ocean").read_text(encoding="utf-8"))
    lakes = json.loads(fetch("natural_earth_lakes").read_text(encoding="utf-8"))
    natural = [
        f
        for f in lakes["features"]
        if f["properties"].get("featurecla") != "Reservoir" and f["properties"].get("name") not in MODERN_LAKES
    ]
    water = {"type": "FeatureCollection", "features": [*ocean["features"], *natural]}
    return round_collection(water)


# Coastlines are drawn only around the region of the map. Using the outline of the water
# polygon everywhere drew its cut along the antimeridian as a line across the Pacific.
COAST_BBOX = (-30.0, -5.0, 90.0, 65.0)


def build_coast(water: dict) -> dict:
    """Outlines of the sea and the lakes inside COAST_BBOX, as lines."""
    x0, y0, x1, y1 = COAST_BBOX
    inside = lambda p: x0 <= p[0] <= x1 and y0 <= p[1] <= y1  # noqa: E731
    lines = []
    for f in water["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            for ring in poly:
                run: list = []
                for pt in ring:
                    if inside(pt):
                        run.append(pt)
                    else:
                        if len(run) > 1:
                            lines.append(run)
                        run = []
                if len(run) > 1:
                    lines.append(run)
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "MultiLineString", "coordinates": lines}}]}


COORD_DECIMALS = 3  # ≈ 100 m: far below what a 1:50m source can show


def round_coords(value: object) -> object:
    """Round every number in a nested coordinate array (drops centimetre noise)."""
    if isinstance(value, list):
        return [round_coords(v) for v in value]
    if isinstance(value, float):
        return round(value, COORD_DECIMALS)
    return value


def round_collection(fc: dict) -> dict:
    """Keep only geometry and properties, with coordinates rounded to COORD_DECIMALS."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": f["geometry"]["type"], "coordinates": round_coords(f["geometry"]["coordinates"])},
            }
            for f in fc["features"]
            if f.get("geometry")
        ],
    }


# Rivers that are biblical places: the OpenBible id carries the verified Russian name.
RIVER_PLACES = {
    "Jordan": "ae686c9",
    "Euphrates": "a62dec4",
    "Al Furat": "a62dec4",  # Arabic name of the Euphrates in Natural Earth
    "Firat": "a62dec4",  # Turkish
    "Tigris": "a38ebfd",
    "Dicle": "a38ebfd",  # Turkish
    "Nile": "a012705",
}
RIVER_NAMES_EN = {"ae686c9": "Jordan", "a62dec4": "Euphrates", "a38ebfd": "Tigris", "a012705": "Nile"}
# Modern canals are not rivers of antiquity.
MODERN_WATERWAYS = re.compile(r"canal|csatorna|kanal", re.IGNORECASE)


def simplify_line(points: list[list[float]], tolerance: float) -> list[list[float]]:
    """Douglas–Peucker. Used for label paths: MapLibre rejects line labels on sharp
    bends, and real river courses meander, so labels follow a smoothed copy."""
    if len(points) < 3:
        return points
    (x0, y0), (x1, y1) = points[0], points[-1]
    dx, dy = x1 - x0, y1 - y0
    norm = math.hypot(dx, dy) or 1e-12
    far, idx = 0.0, 0
    for i, (x, y) in enumerate(points[1:-1], start=1):
        d = abs(dy * x - dx * y + x1 * y0 - y1 * x0) / norm
        if d > far:
            far, idx = d, i
    if far <= tolerance:
        return [points[0], points[-1]]
    left = simplify_line(points[: idx + 1], tolerance)
    return left[:-1] + simplify_line(points[idx:], tolerance)


def build_rivers() -> tuple[dict, dict, dict]:
    """River centrelines (Natural Earth, PD) in the region, as lines for labels along
    the course. Modern courses: the lower Euphrates and Tigris moved since antiquity."""
    src = json.loads(fetch("natural_earth_rivers").read_text(encoding="utf-8"))
    feats = []
    for f in src["features"]:
        p = f["properties"]
        g = f.get("geometry")
        # "Lake Centerline" runs through lakes (the Dead Sea): drawn or labelled, it misleads.
        if not g or p.get("featurecla") != "River":
            continue
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        xs = [pt[0] for line in lines for pt in line]
        ys = [pt[1] for line in lines for pt in line]
        if not xs or not in_bbox(xs, ys):  # a few source features have empty geometry
            continue
        name = p.get("name") or ""
        if MODERN_WATERWAYS.search(name):
            continue
        place = RIVER_PLACES.get(name)
        feats.append({
            "type": "Feature",
            "geometry": {"type": "MultiLineString", "coordinates": [[[round(x, COORD_DECIMALS), round(y, COORD_DECIMALS)] for x, y in line] for line in lines]},
            "properties": {
                # One English name per biblical river, whatever the local spelling in the source.
                "name": RIVER_NAMES_EN[place] if place else name,
                "rank": int(p.get("scalerank") or 9),
                **({"place": RIVER_PLACES[name]} if name in RIVER_PLACES else {}),
            },
        })
    labels = [
        {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": simplify_line(line, 0.15)},
            "properties": f["properties"],
        }
        for f in feats
        if "place" in f["properties"]
        for line in f["geometry"]["coordinates"]
        if len(line) > 1
    ]
    return (
        {"type": "FeatureCollection", "features": feats},
        {"type": "FeatureCollection", "features": labels},
        {"river_lines": len(feats), "river_label_paths": len(labels)},
    )


MAX_SITES = 6
# A place is disputed when the runner-up candidate has at least this share of OpenBible's
# assessment (or nothing is rated). Capernaum, Tell Hum 100 % against Khirbet Minyeh 0 %,
# is not: its card says "generally agreed" and still lists the minority proposal.
DISPUTED_MIN_SHARE = 10

_REF = r'<(?P<kind>ancient|modern) id="(?P<ref>[^"]+)">(?P<text>[^<]*)</(?P=kind)>'
# OpenBible writes a candidate site as a modern name or one of a few English templates.
# Keeping the template and the referenced id lets the content build write a Russian label
# with the Synodal name of the referenced place.
SITE_TEMPLATES = [
    ("same", re.compile(rf"^another name for (?:the )?{_REF}$")),
    ("within", re.compile(rf"^within (?P<n>[\d.]+) (?P<unit>km|m) of (?:the )?{_REF}$")),
    ("around", re.compile(rf"^about (?P<n>[\d.]+) (?P<unit>km|m) around (?:the )?{_REF}$")),
    ("region", re.compile(rf"^region around (?:the )?{_REF}$")),
    ("along", re.compile(rf"^along (?:the )?{_REF}$")),
    ("at", re.compile(rf"^(?:in|on) (?:the )?{_REF}$")),
    ("name", re.compile(rf"^{_REF}$")),
]
NUMBER_SUFFIX = re.compile(r" \d+$")  # "Babylon 1" -> "Babylon": OpenBible's disambiguator


def site_label(description: str, own_name: str = "") -> dict:
    """`label` in English plus, for a known template, `tpl`, `ref`, `ref_text`, `n`, `unit`.

    Only an ancient reference loses OpenBible's disambiguating number ("Babylon 1"); a
    number in a modern name is part of it ("Nahal Yattir 205"). "Another name for" the
    place's own name elsewhere in the Bible becomes `same_name`, so no card reads
    "Ai: same place as Ai".
    """
    for key, pattern in SITE_TEMPLATES:
        m = pattern.match(description)
        if not m:
            continue
        g = m.groupdict()
        ancient = g["kind"] == "ancient"
        ref_text = NUMBER_SUFFIX.sub("", g["text"]) if ancient else g["text"]
        label = TAG_RE.sub("", description)
        if ancient:
            label = label[: len(label) - len(g["text"])] + ref_text if label.endswith(g["text"]) else label
        if key == "same":
            if ref_text == own_name:
                key, label = "same_name", f"same place as {ref_text} in other verses"
            else:
                label = f"same place as {ref_text}"
        out = {"tpl": key, "ref": g["ref"], "ref_text": ref_text}
        if g.get("n"):
            out |= {"n": g["n"], "unit": g["unit"]}
        return {"label": label, **out}
    return {"label": TAG_RE.sub("", description)}


def build_sites(records: list[dict], modern: dict[str, dict]) -> tuple[dict, dict[str, tuple[int, bool]], dict]:
    """Candidate locations of disputed places (ADR 0007: a place ≠ a site).

    OpenBible scores each identification (`score.time_total`, weighted towards recent
    scholarship). We keep candidates with a point we may redistribute, show the best
    MAX_SITES, and turn their positive scores into shares of what is shown, labelled in
    the UI as "OpenBible's assessment", not as a scholarly consensus. When no shown
    candidate has a positive score, `share` is omitted: "not assessed", not "0 %".
    """
    banned = banned_lonlats(modern)
    feats, per_place = [], {}
    for r in records:
        ids = r.get("identifications") or []
        cands = []
        for i, ident in enumerate(ids):
            res = first_point(ident)
            if res is None or coord_banned(res, modern, banned):
                continue
            lon, lat = (float(v) for v in res["lonlat"].split(","))
            score = float((ident.get("score") or {}).get("time_total") or 0)
            base = NUMBER_SUFFIX.sub("", r["friendly_id"])
            cands.append({"i": i, "lon": lon, "lat": lat, "score": score, **site_label(ident.get("description", ""), base)})
        cands = cands[:MAX_SITES]
        if len(cands) < 2:
            continue
        total = sum(max(c["score"], 0) for c in cands)
        shares = sorted((100 * max(c["score"], 0) / total for c in cands), reverse=True) if total > 0 else []
        disputed = not shares or round(shares[1]) >= DISPUTED_MIN_SHARE
        per_place[r["id"]] = (len(cands), disputed)
        for c in cands:
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(c["lon"], 5), round(c["lat"], 5)]},
                "properties": {
                    "place": r["id"],
                    "rank": c["i"],
                    "label": c["label"],
                    **{k: c[k] for k in ("tpl", "ref", "ref_text", "n", "unit") if k in c},
                    **({"share": round(100 * max(c["score"], 0) / total)} if total > 0 else {}),
                },
            })
    stats = {"places_with_sites": len(per_place), "sites": len(feats)}
    return {"type": "FeatureCollection", "features": feats}, per_place, stats


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    records = [json.loads(line) for line in fetch("openbible").open(encoding="utf-8")]
    modern = load_modern()
    sites, sites_per_place, site_stats = build_sites(records, modern)
    rivers, river_labels, river_stats = build_rivers()
    river_places = {f["properties"]["place"] for f in rivers["features"] if "place" in f["properties"]}
    places, place_stats, excluded_places = build_places(records, modern, sites_per_place, river_places)
    # Candidates of a place left out (licence) would be sites of nothing.
    shipped = {f["properties"]["id"] for f in places["features"]}
    sites["features"] = [f for f in sites["features"] if f["properties"]["place"] in shipped]
    site_stats["sites"] = len(sites["features"])
    assert_no_banned_points({"places.geojson": places, "sites.geojson": sites}, modern)
    polities, polity_labels, polity_stats = build_polities()
    water = build_water()
    coast = build_coast(water)
    outputs = {
        "places.geojson": places,
        "sites.geojson": sites,
        "rivers.geojson": rivers,
        "river-labels.geojson": river_labels,
        "polities.geojson": polities,
        "polity-labels.geojson": polity_labels,
        "water.geojson": water,
        "coast.geojson": coast,
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
        # Places left out because their only point may not be redistributed (ADR 0008).
        # Content may keep verified names for them; they return with a licensed point.
        "excluded_places": sorted(excluded_places),
        "stats": {**place_stats, **site_stats, **river_stats, **polity_stats},
        "files": {name: (OUT / name).stat().st_size for name in outputs},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["stats"], ensure_ascii=False), {k: f"{v / 1e6:.1f} MB" for k, v in manifest["files"].items()})


if __name__ == "__main__":
    main()
