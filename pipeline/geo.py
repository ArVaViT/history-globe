"""Geometry the data builds share: the map's region, distances and Douglas–Peucker."""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from typing import TypeVar

# The region of the map, west, south, east, north: Tarshish and Spain
# (Rom 15:24) at one end, Punt at the other.
BBOX = (-12.0, 8.0, 75.0, 50.0)

P = TypeVar("P", bound=Sequence[float])
EARTH_KM = 6371.0


def km(a: Sequence[float], b: Sequence[float]) -> float:
    """Kilometres between two lon/lat points, flat at their middle latitude: true to well
    under a percent at the few kilometres it is asked about."""
    x = math.radians(b[0] - a[0]) * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot(x, math.radians(b[1] - a[1])) * EARTH_KM


def great_circle_km(a: Sequence[float], b: Sequence[float]) -> float:
    """Kilometres between two lon/lat points along the sphere (haversine), at any distance."""
    (lo1, la1), (lo2, la2) = a, b
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(h))


def line_distance(p: Sequence[float], a: Sequence[float], b: Sequence[float]) -> float:
    """From p to the infinite line through a and b."""
    (x, y), (x0, y0), (x1, y1) = p, a, b
    dx, dy = x1 - x0, y1 - y0
    return abs(dy * x - dx * y + x1 * y0 - y1 * x0) / (math.hypot(dx, dy) or 1e-12)


def segment_distance(p: Sequence[float], a: Sequence[float], b: Sequence[float]) -> float:
    """From p to the nearest point of the segment ab."""
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    u = 0.0 if length2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
    return math.hypot(px - ax - u * dx, py - ay - u * dy)


def simplify(
    points: list[P],
    tolerance: float,
    distance: Callable[[Sequence[float], Sequence[float], Sequence[float]], float] = line_distance,
) -> list[P]:
    """Douglas–Peucker without recursion, so a shore of a hundred thousand points needs no
    deeper stack: the farthest point from each chord stays while it is beyond the tolerance."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    spans = [(0, len(points) - 1)]
    while spans:
        i, j = spans.pop()
        far, at = 0.0, 0
        for k in range(i + 1, j):
            d = distance(points[k], points[i], points[j])
            if d > far:
                far, at = d, k
        if far > tolerance:
            keep[at] = True
            spans += [(i, at), (at, j)]
    return [p for p, k in zip(points, keep) if k]
