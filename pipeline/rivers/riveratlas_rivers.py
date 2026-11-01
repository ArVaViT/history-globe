"""The small biblical rivers (Jabbok, Arnon, Kishon, …) from RiverATLAS v1.0, the HydroRIVERS
network with its attributes, released under CC BY 4.0 (Linke et al. 2019, Scientific Data 6: 283,
https://doi.org/10.6084/m9.figshare.9890531). Only the geometry and the network columns are read:
some attribute columns of RiverATLAS are under ODbL, which this project does not take.

Each river is named by one point on its course (`via` in targets.json). From the reach there the
line runs upstream, always up the larger branch, to the source (or from a named `source`: the
Jabbok rises at Rabbah, Amman, not in the larger desert branch), and downstream until it joins a
river more than three times its size, or reaches the sea or a sink, or its known `mouth`. The part
inside a lake (the Dead Sea, the Sea of Galilee) is cut away.

Run once, by hand; the output is kept in git and read by build_data.py:
  RiverATLAS_Data_v10_shp.zip from the figshare record above; unzip RiverATLAS_v10_eu.* and _af.*
  into <dir>; uv venv -p 3.12 <venv> && uv pip install pyogrio shapely
  <venv>/bin/python pipeline/rivers/riveratlas_rivers.py <dir>"""
import json, math, sys
from pathlib import Path
import pyogrio, shapely
from shapely.geometry import LineString, shape
from shapely.ops import linemerge, unary_union

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from build_data import simplify_line  # noqa: E402

D = Path(sys.argv[1])
BOX = (33.0, 29.0, 37.5, 34.0)
COLS = ["HYRIV_ID", "NEXT_DOWN", "UPLAND_SKM"]
# A river ends where it meets one more than three times its size (Kanah into the Yarkon), not
# where two wadis of a size meet (the Kidron above the Dead Sea); `join` in targets.json overrides
# it for a river whose larger neighbour is less than three times its size (Kanah, Yarkon).
JOIN = 3
reach, down, up_of = {}, {}, {}
for reg in ("eu", "af"):
    meta, _, geom, fields = pyogrio.raw.read(D / f"RiverATLAS_v10_{reg}.shp", columns=COLS, bbox=BOX)
    ids, nxt, upl = (fields[meta["fields"].tolist().index(c)] for c in COLS)
    for g, i, n, u in zip(shapely.from_wkb(geom), ids, nxt, upl):
        i, n = int(i), int(n)
        reach[i] = (g, float(u))
        down[i] = n
        up_of.setdefault(n, []).append(i)

lakes = json.loads((HERE.parent / ".cache" / "ne_50m_lakes.geojson").read_text(encoding="utf-8"))
water = unary_union([shape(f["geometry"]) for f in lakes["features"]]).intersection(shapely.box(*BOX))


def nearest(lon: float, lat: float) -> int:
    p = shapely.Point(lon, lat)
    return min((i for i, (_, u) in reach.items() if u >= 10), key=lambda i: reach[i][0].distance(p))


def stem(via: int, source: int | None, join: float) -> list[int]:
    if source is None:
        path = [via]
        while up_of.get(path[0]):
            path.insert(0, max(up_of[path[0]], key=lambda i: reach[i][1]))
    else:  # the named source, down to the river's point whatever the larger branch
        path = [source]
        while path[-1] != via:
            if down[path[-1]] not in reach:
                raise SystemExit(f"the source does not flow past the river's point (reach {via})")
            path.append(down[path[-1]])
    while down.get(path[-1]) in reach and reach[down[path[-1]]][1] <= join * reach[path[-1]][1]:
        path.append(down[path[-1]])
    return path


targets = json.loads((HERE / "targets.json").read_text(encoding="utf-8"))
out = []
for t in targets:
    path = stem(nearest(*t["via"]), nearest(*t["source"]) if "source" in t else None, t.get("join", JOIN))
    line = linemerge([reach[i][0] for i in path])
    if line.geom_type != "LineString":
        line = max(line.geoms, key=lambda g: g.length)
    if "mouth" in t:
        line = shapely.ops.substring(line, 0, line.project(shapely.Point(t["mouth"])))
    dry = line.difference(water)
    if dry.geom_type != "LineString":
        dry = linemerge(dry) if dry.geom_type == "MultiLineString" else dry
        if dry.geom_type != "LineString":
            dry = max(dry.geoms, key=lambda g: g.length)
    pts = simplify_line([[round(x, 5), round(y, 5)] for x, y in dry.coords], 0.0015)
    km = sum(math.dist(a, b) for a, b in zip(pts, pts[1:])) * 100
    props = {"place": t["id"], "name": t["name"], "basin_km2": round(reach[path[-1]][1]), "km": round(km)}
    if t.get("unlabelled"):
        props["unlabelled"] = True
    out.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": pts}, "properties": props})
    print(t["name"], props["basin_km2"], "km2", props["km"], "km", len(pts), "pts")

(HERE / "small-rivers.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":")) + "\n", encoding="utf-8")
