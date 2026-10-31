"""The small biblical rivers (Jabbok, Arnon, Kishon, …), traced by us from the Copernicus
DEM GLO-90: D8 flow over the filled relief, the main stem upstream of each river's place, then
downstream to where it joins a larger river, a lake or the sea, or to its known mouth. Natural
Earth draws only the large rivers; the open river networks with small streams (HydroRIVERS,
Hydrography90m) do not allow an open CC BY release. The lines are our own derived data.

Run once, by hand; the output is kept in git and read by build_data.py:
  DEM tiles: https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N{29..33}_00_E{033..036}_00_DEM/<same>.tif in <dir>/dem
  uv venv -p 3.12 <dir>/venv && uv pip install pysheds rasterio
  <dir>/venv/bin/python pipeline/rivers/trace_small_rivers.py <dir>
Produced using Copernicus WorldDEM-90 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH
2014–2018, provided under COPERNICUS by the European Union and ESA; all rights reserved."""
import glob, json, sys
import numpy; numpy.in1d = numpy.isin  # pysheds 0.4 on numpy 2
import numpy as np, rasterio
from rasterio.merge import merge
from pysheds.sview import Raster, ViewFinder
from pysheds.grid import Grid

D = sys.argv[1]
srcs = [rasterio.open(f) for f in sorted(glob.glob(f"{D}/dem/*.tif"))]
step = 2  # 3" -> 6" (~180 m)
arr, tr = merge(srcs, bounds=(33, 29, 37, 34), res=(srcs[0].res[0] * step, srcs[0].res[1] * step), nodata=-32767)
z = arr[0].astype("float64")
z[z == -32767] = np.nan
# The sea and the Dead Sea are outlets, not basins to fill.
z[(z <= 0.5) & (np.arange(z.shape[1])[None, :] * tr.a + tr.c < 35.12)] = np.nan
z[z <= -400] = np.nan
nod = -9999.0
zz = np.where(np.isnan(z), nod, z)
vf = ViewFinder(affine=tr, shape=z.shape, crs="EPSG:4326", nodata=nod)
dem = Raster(zz, viewfinder=vf)
g = Grid(viewfinder=vf)
dem = g.resolve_flats(g.fill_depressions(g.fill_pits(dem)))
dirmap = (64, 128, 1, 2, 4, 8, 16, 32)  # N NE E SE S SW W NW
fdir = g.flowdir(dem, dirmap=dirmap)
acc = np.asarray(g.accumulation(fdir, dirmap=dirmap))
fd = np.asarray(fdir)
DR = {64: (-1, 0), 128: (-1, 1), 1: (0, 1), 2: (1, 1), 4: (1, 0), 8: (1, -1), 16: (0, -1), 32: (-1, -1)}
cell_km2 = (abs(tr.a) * 111.32 * np.cos(np.radians(31.5))) * (abs(tr.e) * 110.57)
inv = ~tr
def rc(lon, lat):
    c, r = inv * (lon, lat); return int(r), int(c)
def ll(r, c):
    x, y = tr * (c + 0.5, r + 0.5); return [round(x, 5), round(y, 5)]
def snap(lon, lat, km):
    r0, c0 = rc(lon, lat); w = int(km / (abs(tr.a) * 100)) + 1
    sub = acc[r0 - w:r0 + w + 1, c0 - w:c0 + w + 1]
    i = np.unravel_index(np.nanargmax(sub), sub.shape); return r0 - w + i[0], c0 - w + i[1]
def up(r, c, min_cells, box=None):
    path = [(r, c)]
    while True:
        best = None
        for d, (dr, dc) in DR.items():
            rr, cc = r - dr, c - dc  # a neighbour whose flow points here
            if 0 <= rr < fd.shape[0] and 0 <= cc < fd.shape[1] and fd[rr, cc] == d and acc[rr, cc] >= min_cells and (box is None or (box[0] <= ll(rr, cc)[0] <= box[2] and box[1] <= ll(rr, cc)[1] <= box[3])):
                if best is None or acc[rr, cc] > acc[best]: best = (rr, cc)
        if best is None: return path
        r, c = best; path.append(best)
def down(r, c, stop_ratio):
    a0, path = acc[r, c], []
    for _ in range(2000):
        d = fd[r, c]
        if d not in DR: break
        r, c = r + DR[d][0], c + DR[d][1]
        if not (0 <= r < fd.shape[0] and 0 <= c < fd.shape[1]) or np.isnan(z[r, c]): break
        path.append((r, c))
        if acc[r, c] > a0 * stop_ratio: break
    return path
HERE = __import__("pathlib").Path(__file__).parent
T = json.load(open(HERE / "targets.json"))
feats = []
for t in T:
    r, c = snap(t["lon"], t["lat"], t.get("snap_km", 2))
    upstream = up(r, c, max(1, int(t.get("min_km2", 20) / cell_km2)), t.get("box"))
    downstream = down(r, c, t.get("join", 2.5))
    mouth = t.get("mouth")
    if mouth:
        # Cut the way down where it comes nearest the known mouth, and end at the mouth.
        dist = [(ll(*p)[0] - mouth[0]) ** 2 + (ll(*p)[1] - mouth[1]) ** 2 for p in downstream]
        downstream = downstream[: dist.index(min(dist)) + 1] if dist else []
    line = list(reversed(upstream)) + downstream
    coords = [ll(*p) for p in line] + ([mouth] if mouth else [])
    km = len(line) * abs(tr.a) * 100
    feats.append({"type": "Feature", "properties": {"place": t["id"], "name": t["name"], **({"unlabelled": True} if t.get("unlabelled") else {}), "basin_km2": round(float(acc[r, c]) * cell_km2), "km": round(km)},
                  "geometry": {"type": "LineString", "coordinates": coords}})
    print(t["name"], "basin", round(float(acc[r, c]) * cell_km2), "km2, ~", round(km), "km,", len(coords), "pts")
# Simplified to about 150 m: the lines are drawn at zoom 6 to 11.
sys.path.insert(0, str(HERE.parent))
from build_data import simplify_line  # noqa: E402
for f in feats:
    f["geometry"]["coordinates"] = simplify_line(f["geometry"]["coordinates"], 0.0015)
json.dump({"type": "FeatureCollection", "features": feats}, open(HERE / "small-rivers.geojson", "w"), separators=(",", ":"))
