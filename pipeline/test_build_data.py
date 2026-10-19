"""Licence rules of the pipeline (ADR 0008). Run: python3 -m unittest discover pipeline"""

import unittest

from build_data import (
    identification_confidence,
    COAST_BBOX,
    banned_lonlats,
    build_coast,
    clip_ring,
    join_holes,
    ring_area,
    simplify_shore,
    OUTSIDE_REGION,
    BBOX,
    coord_banned,
    ensure_low_tier,
    label_anchors,
    lead_anchor,
    move_points,
    place_kind,
    qid,
    rank_of,
    site_label,
)

MODERN = {
    "m_osm": {"lonlat": "35.1,31.1", "coordinates_source": {"type": "osm", "geometry_credit": "osm"}},
    "m_google": {"lonlat": "35.2,31.2", "coordinates_source": {"type": "google_maps"}},
    "m_copy": {"lonlat": "35.2,31.2"},  # no source of its own, same digits as the Google point
    "m_wd": {"lonlat": "35.3,31.3", "coordinates_source": {"type": "wikidata"}},
}
BANNED = banned_lonlats(MODERN)
OSM_OUTLINE = {"local": {"geometry_credit": "osm"}}


def res(basis: str, lonlat: str, roles: dict | None = None) -> dict:
    return {"modern_basis_id": basis, "lonlat": lonlat, "geojson_roles": roles or {}}


class CoordBanned(unittest.TestCase):
    def test_point_copied_from_osm(self) -> None:
        self.assertTrue(coord_banned(res("m_osm", "35.1,31.1"), MODERN, BANNED))

    def test_point_copied_from_google(self) -> None:
        self.assertTrue(coord_banned(res("m_google", "35.2,31.2"), MODERN, BANNED))

    def test_unsourced_copy_of_a_google_point(self) -> None:
        self.assertTrue(coord_banned(res("m_copy", "35.2,31.2"), MODERN, BANNED))

    def test_point_computed_from_an_osm_polygon(self) -> None:
        self.assertTrue(coord_banned(res("m_wd", "35.35,31.35", OSM_OUTLINE), MODERN, BANNED))

    def test_wikidata_point_next_to_an_osm_outline_is_fine(self) -> None:
        self.assertFalse(coord_banned(res("m_wd", "35.3,31.3", OSM_OUTLINE), MODERN, BANNED))

    def test_wikidata_point_is_fine(self) -> None:
        self.assertFalse(coord_banned(res("m_wd", "35.3,31.3"), MODERN, BANNED))


class MovePoints(unittest.TestCase):
    def feats(self) -> list[dict]:
        return [
            {"geometry": {"coordinates": [35.78, 31.50]}, "properties": {"id": "dimonah", "coord": "openbible"}},
            {"geometry": {"coordinates": [35.16, 31.30]}, "properties": {"id": "dibon", "coord": "wikidata"}},
        ]

    def test_takes_the_other_record_point_and_its_source(self) -> None:
        feats = self.feats()
        self.assertEqual(move_points(feats, {"dimonah": "dibon"}), 1)
        self.assertEqual(feats[0]["geometry"]["coordinates"], [35.16, 31.30])
        self.assertEqual(feats[0]["properties"]["coord"], "wikidata")
        self.assertEqual(feats[1]["geometry"]["coordinates"], [35.16, 31.30])

    def test_a_place_outside_the_build_stops_it(self) -> None:
        with self.assertRaises(SystemExit):
            move_points(self.feats(), {"dimonah": "left-out"})


class Rank(unittest.TestCase):
    def test_thresholds(self) -> None:
        self.assertEqual([rank_of(n) for n in (40, 39, 10, 9, 3, 2)], [0, 1, 1, 2, 2, 3])


class SiteLabel(unittest.TestCase):
    def test_another_name(self) -> None:
        got = site_label('another name for <ancient id="a818a40">Abila</ancient>')
        self.assertEqual(got, {"label": "same place as Abila", "tpl": "same", "ref": "a818a40", "ref_text": "Abila"})

    def test_distance_drops_the_disambiguator(self) -> None:
        got = site_label('within 250 km of <ancient id="a217d18">Babylon 1</ancient>')
        self.assertEqual(got["label"], "within 250 km of Babylon")
        self.assertEqual((got["tpl"], got["n"], got["unit"], got["ref_text"]), ("within", "250", "km", "Babylon"))

    def test_own_name_elsewhere(self) -> None:
        got = site_label('another name for <ancient id="a1">Ai 1</ancient>', "Ai")
        self.assertEqual((got["tpl"], got["label"]), ("same_name", "same place as Ai in other verses"))

    def test_modern_numbers_are_kept(self) -> None:
        got = site_label('along <modern id="m1">Nahal Yattir 205</modern>')
        self.assertEqual(got["label"], "along Nahal Yattir 205")

    def test_free_text_stays_as_it_is(self) -> None:
        got = site_label('in the region <modern id="m56a09d">north of the Dead Sea</modern>')
        self.assertEqual(got, {"label": "in the region north of the Dead Sea"})


class Coast(unittest.TestCase):
    def test_keeps_shores_in_the_region_and_drops_the_antimeridian_cut(self) -> None:
        sea = [[35.0, 30.0], [36.0, 30.0], [36.0, 31.0], [35.0, 30.0]]
        cut = [[180.0, -60.0], [180.0, 60.0], [179.0, 60.0], [180.0, -60.0]]
        water = {"features": [{"geometry": {"type": "MultiPolygon", "coordinates": [[sea], [cut]]}}]}
        lines = build_coast(water)["features"][0]["geometry"]["coordinates"]
        self.assertEqual(lines, [sea])
        x0, y0, x1, y1 = COAST_BBOX
        self.assertTrue(all(x0 <= x <= x1 and y0 <= y <= y1 for line in lines for x, y in line))




class Clip(unittest.TestCase):
    def test_cuts_a_ring_to_a_rectangle_and_drops_what_is_outside(self) -> None:
        square = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]
        got = clip_ring(square, (5.0, -1.0, 20.0, 20.0))
        self.assertEqual(sorted(map(tuple, got[:-1])), [(5.0, 0.0), (5.0, 10.0), (10.0, 0.0), (10.0, 10.0)])
        self.assertEqual(got[0], got[-1])
        self.assertIsNone(clip_ring(square, (20.0, 20.0, 30.0, 30.0)))

    def test_keeps_the_region_and_the_bands_around_it_apart(self) -> None:
        # Every band touches the region only along its edge.
        for x0, y0, x1, y1 in OUTSIDE_REGION:
            self.assertFalse(x0 < BBOX[2] and x1 > BBOX[0] and y0 < BBOX[3] and y1 > BBOX[1])


class Holes(unittest.TestCase):
    def test_joins_islands_to_the_sea_by_cuts_at_sea(self) -> None:
        sea = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]
        west = [[2.0, 4.0], [2.0, 6.0], [3.0, 6.0], [3.0, 4.0], [2.0, 4.0]]
        east = [[6.0, 4.5], [6.0, 5.5], [7.0, 5.5], [7.0, 4.5], [6.0, 4.5]]
        ring = join_holes([sea, east, west])
        self.assertEqual(ring[0], ring[-1])
        # One ring, its area the sea's less the islands', every island corner on it.
        self.assertAlmostEqual(ring_area(ring[:-1]), 100.0 - 2.0 - 1.0)
        for corner in west[:-1] + east[:-1]:
            self.assertIn(corner, ring)
        # The west island is cut to the shore, the east one to the west island, both
        # straight west at sea.
        self.assertIn([0.0, 4.0], ring)
        self.assertIn([3.0, 4.5], ring)

    def test_leaves_a_polygon_without_holes_as_it_is(self) -> None:
        sea = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]
        self.assertEqual(join_holes([sea]), sea)


class Shore(unittest.TestCase):
    def test_keeps_a_closed_ring_a_ring(self) -> None:
        island = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.0, 0.0]]
        got = simplify_shore(island, 0.01)
        self.assertEqual(got[0], got[-1])
        self.assertGreaterEqual(len(got), 4)
        self.assertEqual(simplify_shore([[0.0, 0.0], [1.0, 0.0001], [2.0, 0.0]], 0.01), [[0.0, 0.0], [2.0, 0.0]])


class LabelTiers(unittest.TestCase):
    def test_centroid_coarse_and_fine_grid(self) -> None:
        # A 24 x 24 degree square inside the region: its centroid, and a 6-degree grid of
        # which every other point on both axes is the coarse 12-degree grid.
        square = [[[30.0, 20.0], [54.0, 20.0], [54.0, 44.0], [30.0, 44.0], [30.0, 20.0]]]
        anchors = label_anchors([square])
        tiers = [a[3] for a in anchors]
        self.assertEqual(tiers.count(0), 1)
        centroid = next(a for a in anchors if a[3] == 0)
        self.assertAlmostEqual(centroid[0], 42.0, places=6)
        self.assertAlmostEqual(centroid[1], 32.0, places=6)
        coarse = [(a[0], a[1]) for a in anchors if a[3] == 1]
        fine = [(a[0], a[1]) for a in anchors if a[3] == 2]
        self.assertTrue(coarse and fine)
        for x, y in coarse:
            self.assertEqual(round((x - 3) / 6) % 2, 0)
            self.assertEqual(round((y - 3) / 6) % 2, 0)
        self.assertGreater(len(fine), len(coarse))

    def test_a_polity_without_coarse_points_gets_one(self) -> None:
        square = [[[30.0, 20.0], [36.0, 20.0], [36.0, 26.0], [30.0, 26.0], [30.0, 20.0]]]
        fine_only = [(33.0, 21.0, 36.0, 2), (33.0, 25.0, 36.0, 2)]
        raised = ensure_low_tier(fine_only, [square])
        self.assertEqual(sorted(a[3] for a in raised), [1, 2])
        kept = [(33.0, 23.0, 36.0, 0), (33.0, 25.0, 36.0, 2)]
        self.assertEqual(ensure_low_tier(kept, [square]), kept)

    def test_a_polity_without_any_point_gets_one_inside(self) -> None:
        # An L-shaped part whose centroid falls outside it, too small for the grid.
        ell = [[[30.0, 20.0], [31.0, 20.0], [31.0, 20.2], [30.2, 20.2], [30.2, 21.0], [30.0, 21.0], [30.0, 20.0]]]
        [(x, y, _, tier)] = ensure_low_tier([], [ell])
        self.assertEqual(tier, 1)
        self.assertTrue(30.0 <= x <= 31.0 and 20.0 <= y <= 21.0)

    def test_one_lead_point_names_the_polity_far_out(self) -> None:
        square = [[[30.0, 20.0], [36.0, 20.0], [36.0, 26.0], [30.0, 26.0], [30.0, 20.0]]]
        # The middle (33, 23) is the nearest low-tier point; a fine point is never the lead.
        anchors = [(30.5, 20.5, 36.0, 1), (33.0, 23.2, 36.0, 1), (33.0, 23.0, 36.0, 2)]
        self.assertEqual(lead_anchor(anchors, [square]), 1)
        self.assertIsNone(lead_anchor([(33.0, 23.0, 36.0, 2)], [square]))



class IdentificationConfidenceTest(unittest.TestCase):
    def test_clamped_score(self) -> None:
        self.assertEqual(identification_confidence({"score": {"time_total": 1104}}), 1000)
        self.assertEqual(identification_confidence({"score": {"time_total": 426.4}}), 426)
        self.assertEqual(identification_confidence({"score": {"time_total": -50}}), 0)
        self.assertIsNone(identification_confidence({}))
        self.assertIsNone(identification_confidence({"score": {}}))

class PlaceKindTest(unittest.TestCase):
    def test_island_only_where_nothing_else_is_said(self):
        self.assertEqual(place_kind(["island", "settlement"]), "settlement")
        self.assertEqual(place_kind(["island", "mine", "region", "settlement"]), "region")
        self.assertEqual(place_kind(["island", "region"]), "island")
        self.assertEqual(place_kind(["island"]), "island")
        self.assertEqual(place_kind(None), "place")

    def test_special_is_not_a_kind(self):
        self.assertEqual(place_kind(["special", "spring"]), "spring")
        self.assertEqual(place_kind(["special", "valley"]), "valley")
        self.assertEqual(place_kind(["settlement", "special"]), "settlement")
        self.assertEqual(place_kind(["special", "stone heap"]), "stone heap")
        self.assertEqual(place_kind(["island", "region", "settlement", "special"]), "region")
        self.assertEqual(place_kind(["special"]), "place")


if __name__ == "__main__":
    unittest.main()



class Qid(unittest.TestCase):
    def test_plain_link(self) -> None:
        self.assertEqual(qid({"linked_data": {"s7cc8b2": {"id": "Q379652"}}}), "Q379652")

    def test_link_marked_not_or_modern_is_no_link(self) -> None:
        # OpenBible, Adamah: {"id": "Q2605670", "modifier": "not"}; Iconium: "modern" (Konya).
        self.assertIsNone(qid({"linked_data": {"s7cc8b2": {"id": "Q2605670", "modifier": "not"}}}))
        self.assertIsNone(qid({"linked_data": {"s7cc8b2": {"id": "Q79857", "modifier": "modern"}}}))


class FetchChecksThePin(unittest.TestCase):
    """A source is read at a pinned commit and must hash as pipeline/sources.json says."""

    def setUp(self) -> None:
        import hashlib
        import pathlib
        import tempfile
        from unittest import mock

        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.upstream = self.tmp / "upstream.txt"
        self.upstream.write_text("the file at the pinned commit\n", encoding="utf-8")
        self.cache = self.tmp / "cache"
        self.patch = mock.patch("build_data.CACHE", self.cache)
        self.patch.start()
        self.sources = {"x": {"file": "x.txt", "url": self.upstream.as_uri(), "license": "PD", "credit": ""}}
        self.good = hashlib.sha256(self.upstream.read_bytes()).hexdigest()

    def tearDown(self) -> None:
        import shutil

        self.patch.stop()
        shutil.rmtree(self.tmp)

    def test_downloads_and_keeps_a_file_that_hashes_as_pinned(self) -> None:
        from build_data import fetch

        path = fetch("x", self.sources, {"x": {"sha256": self.good}})
        self.assertEqual(path.read_bytes(), self.upstream.read_bytes())
        # A second call reads the cache and checks it again.
        self.assertEqual(fetch("x", self.sources, {"x": {"sha256": self.good}}), path)

    def test_removes_a_download_that_does_not_hash_so_and_stops(self) -> None:
        from build_data import fetch

        with self.assertRaises(SystemExit) as stop:
            fetch("x", self.sources, {"x": {"sha256": "0" * 64}})
        self.assertIn("sources.json", str(stop.exception))
        self.assertFalse((self.cache / "x.txt").exists())

    def test_removes_a_cached_file_that_was_changed(self) -> None:
        from build_data import fetch

        fetch("x", self.sources, {"x": {"sha256": self.good}})
        (self.cache / "x.txt").write_text("changed on disk\n", encoding="utf-8")
        with self.assertRaises(SystemExit):
            fetch("x", self.sources, {"x": {"sha256": self.good}})
        self.assertFalse((self.cache / "x.txt").exists())

    def test_every_source_of_the_build_is_pinned_with_a_hash(self) -> None:
        from build_data import PINS, SOURCES

        for name, src in SOURCES.items():
            if src.get("generated"):
                continue
            self.assertIn(name, PINS, name)
            self.assertRegex(PINS[name]["commit"], r"^[0-9a-f]{40}$")
            self.assertRegex(PINS[name]["sha256"], r"^[0-9a-f]{64}$")
            self.assertIn(PINS[name]["commit"], src["url"])
