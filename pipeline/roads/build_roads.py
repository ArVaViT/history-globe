#!/usr/bin/env python3
"""Build the Roman roads layer for History Globe from the Itiner-e dataset.

Source: Zenodo 10.5281/zenodo.17122148, file itinere_roads.geojson
(EPSG:3395, World Mercator). Python standard library only.

Usage:
  python3 build_roads.py [path_to_itinere_roads.geojson]
      [--tol-major 100] [--tol-minor 200] [--prec 4]

Steps: clip to the map frame (Cohen–Sutherland in Mercator metres),
Douglas–Peucker in Mercator metres (so the tolerance is the same in screen
pixels at any latitude), inverse projection to WGS84, coordinate rounding.
Output: two levels that together make up the whole network, with no overlap:
  roads-major.geojson: Main Road (tolerance 100 m), for zoom 5+;
  roads-minor.geojson: Secondary Road (tolerance 200 m), for zoom 7+.
A single file with the whole network does not fit in 3 MB / 800 KB gzip
without a coarse tolerance.
"""
import gzip, json, math, os, sys, argparse

A = 6378137.0                      # WGS84 semi-major axis
E = 0.0818191908426215             # WGS84 eccentricity
BBOX = (-12.0, 8.0, 75.0, 50.0)    # lon_min, lat_min, lon_max, lat_max
SOURCE = "Itiner-e static 2024 v1.3, doi:10.5281/zenodo.17122148, CC BY 4.0"


def fwd(lon, lat):
    """Forward EPSG:3395 (ellipsoidal Mercator)."""
    phi = math.radians(lat)
    es = E * math.sin(phi)
    y = A * math.log(math.tan(math.pi / 4 + phi / 2) * ((1 - es) / (1 + es)) ** (E / 2))
    return A * math.radians(lon), y


def inv(x, y):
    """Inverse EPSG:3395, iterating on latitude."""
    t = math.exp(-y / A)
    phi = math.pi / 2 - 2 * math.atan(t)
    for _ in range(10):
        es = E * math.sin(phi)
        nphi = math.pi / 2 - 2 * math.atan(t * ((1 - es) / (1 + es)) ** (E / 2))
        if abs(nphi - phi) < 1e-12:
            phi = nphi
            break
        phi = nphi
    return math.degrees(x / A), math.degrees(phi)


def clip_line(pts, xmin, ymin, xmax, ymax):
    """Clip a polyline to a rectangle; return the list of pieces inside it."""
    def code(x, y):
        c = 0
        if x < xmin: c |= 1
        elif x > xmax: c |= 2
        if y < ymin: c |= 4
        elif y > ymax: c |= 8
        return c

    def clip_seg(x0, y0, x1, y1):
        c0, c1 = code(x0, y0), code(x1, y1)
        while True:
            if not (c0 | c1):
                return (x0, y0, x1, y1)
            if c0 & c1:
                return None
            c = c0 or c1
            if c & 8:   x, y = x0 + (x1 - x0) * (ymax - y0) / (y1 - y0), ymax
            elif c & 4: x, y = x0 + (x1 - x0) * (ymin - y0) / (y1 - y0), ymin
            elif c & 2: x, y = xmax, y0 + (y1 - y0) * (xmax - x0) / (x1 - x0)
            else:       x, y = xmin, y0 + (y1 - y0) * (xmin - x0) / (x1 - x0)
            if c == c0: x0, y0, c0 = x, y, code(x, y)
            else:       x1, y1, c1 = x, y, code(x, y)

    out, cur = [], []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        s = clip_seg(x0, y0, x1, y1)
        if s is None:
            if len(cur) > 1: out.append(cur)
            cur = []
            continue
        a, b = (s[0], s[1]), (s[2], s[3])
        if not cur or cur[-1] != a:
            if len(cur) > 1: out.append(cur)
            cur = [a]
        cur.append(b)
        if b != (x1, y1):           # left the frame
            out.append(cur); cur = []
    if len(cur) > 1: out.append(cur)
    return out


def dp(pts, tol):
    """Douglas–Peucker, iterative."""
    n = len(pts)
    if n < 3: return pts
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    t2 = tol * tol
    while stack:
        i, j = stack.pop()
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            if L2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
                d = (px - ax - u * dx) ** 2 + (py - ay - u * dy) ** 2
            if d > best: best, bi = d, k
        if best > t2:
            keep[bi] = True
            stack += [(i, bi), (bi, j)]
    return [p for p, k in zip(pts, keep) if k]


TYPE = {"Main Road": "major", "Secondary Road": "minor"}
ITIN = False  # itinerary name (Tabula Peutingeriana etc.) costs ~0.4 MB
CERT = {"Certain": "certain", "Conjectured": "conjectured", "Hypothetical": "hypothetical"}


def build(src, tols, prec):
    raw = json.load(open(src, encoding="utf-8"))
    xmin, ymin = fwd(BBOX[0], BBOX[1]); xmax, ymax = fwd(BBOX[2], BBOX[3])
    feats, stats = [], {"in": len(raw["features"]), "in_vertices": 0, "out_vertices": 0}
    for f in raw["features"]:
        p, g = f["properties"], f["geometry"]
        if not g: continue
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        tol = tols[TYPE.get(p["Type"], "minor")]
        parts = []
        for line in lines:
            pts = [(c[0], c[1]) for c in line]
            stats["in_vertices"] += len(pts)
            for piece in clip_line(pts, xmin, ymin, xmax, ymax):
                s = dp(piece, tol)
                ll, prev = [], None
                for x, y in s:
                    lon, lat = inv(x, y)
                    q = [round(lon, prec), round(lat, prec)]
                    if q != prev: ll.append(q); prev = q
                if len(ll) > 1: parts.append(ll)
        if not parts: continue
        stats["out_vertices"] += sum(len(x) for x in parts)
        props = {
            "ids": [p["InLine_FID"]],
            "name": p["Name"],
            "type": TYPE.get(p["Type"], p["Type"]),
            "cert": CERT.get(p["Segment_s"], p["Segment_s"]),
        }
        if ITIN and p.get("Itinerary"): props["itin"] = p["Itinerary"]
        geom = ({"type": "LineString", "coordinates": parts[0]} if len(parts) == 1
                else {"type": "MultiLineString", "coordinates": parts})
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
    stats["segments_clipped"] = len(feats)
    return merge(feats), stats


def stitch(lines):
    """Join lines whose endpoints coincide (after rounding)."""
    lines = [list(l) for l in lines]
    changed = True
    while changed:
        changed = False
        ends = {}
        for i, l in enumerate(lines):
            ends.setdefault(tuple(l[0]), []).append(i)
            ends.setdefault(tuple(l[-1]), []).append(i)
        used, out = set(), []
        for i, l in enumerate(lines):
            if i in used: continue
            used.add(i); cur = l
            grown = True
            while grown:
                grown = False
                for end_is_tail in (True, False):
                    key = tuple(cur[-1] if end_is_tail else cur[0])
                    for j in ends.get(key, []):
                        if j in used: continue
                        o = lines[j]
                        if end_is_tail:
                            seg = o if tuple(o[0]) == key else o[::-1]
                            cur = cur + seg[1:]
                        else:
                            seg = o if tuple(o[-1]) == key else o[::-1]
                            cur = seg + cur[1:]
                        used.add(j); grown = changed = True
                        break
                    if grown: break
            out.append(cur)
        lines = out
    return lines


def merge(feats):
    """Group segments with the same name+type+cert into one feature."""
    groups = {}
    for f in feats:
        p = f["properties"]
        k = (p["name"], p["type"], p["cert"], p.get("itin"))
        g = groups.setdefault(k, {"props": dict(p, ids=[]), "lines": []})
        g["props"]["ids"] += p["ids"]
        geom = f["geometry"]
        g["lines"] += [geom["coordinates"]] if geom["type"] == "LineString" else geom["coordinates"]
    out = []
    for g in groups.values():
        lines = stitch(g["lines"])
        g["props"]["ids"].sort()
        geom = ({"type": "LineString", "coordinates": lines[0]} if len(lines) == 1
                else {"type": "MultiLineString", "coordinates": lines})
        out.append({"type": "Feature", "properties": g["props"], "geometry": geom})
    out.sort(key=lambda f: f["properties"]["ids"][0])
    return out


def write(path, feats):
    fc = {"type": "FeatureCollection",
          "attribution": "Roman roads: Itiner-e (de Soto, Pažout, Brughmans et al. 2025), CC BY 4.0, simplified",
          "source": SOURCE, "features": feats}
    data = json.dumps(fc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    open(path, "wb").write(data)
    gz = len(gzip.compress(data, 9))
    return len(data), gz


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?", default="raw/itinere_roads.geojson")
    # 1 px at z9 (512 px tiles) = 153 Mercator metres; at z7 = 611 m
    ap.add_argument("--tol-major", type=float, default=100.0, help="DP tolerance for Main Road, Mercator m")
    ap.add_argument("--tol-minor", type=float, default=200.0, help="DP tolerance for Secondary Road, Mercator m")
    ap.add_argument("--prec", type=int, default=4, help="digits after the decimal point")
    ap.add_argument("--outdir", default=".")
    a = ap.parse_args()
    feats, st = build(a.src, {"major": a.tol_major, "minor": a.tol_minor}, a.prec)
    major = [f for f in feats if f["properties"]["type"] == "major"]
    minor = [f for f in feats if f["properties"]["type"] != "major"]
    s_maj = write(os.path.join(a.outdir, "roads-major.geojson"), major)
    s_min = write(os.path.join(a.outdir, "roads-minor.geojson"), minor)
    print(json.dumps({"tol_major_m": a.tol_major, "tol_minor_m": a.tol_minor, "prec": a.prec, "features_in": st["in"],
                      "segments_clipped": st["segments_clipped"], "features_out": len(feats), "major_out": len(major), "minor_out": len(minor),
                      "vertices_in": st["in_vertices"], "vertices_out": st["out_vertices"],
                      "minor_bytes": s_min[0], "minor_gz": s_min[1],
                      "major_bytes": s_maj[0], "major_gz": s_maj[1]}, ensure_ascii=False))
