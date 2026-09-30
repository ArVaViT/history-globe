"""Licence rules of the pipeline (ADR 0008). Run: python3 -m unittest discover pipeline"""

import unittest

from build_data import (
    COAST_BBOX,
    banned_lonlats,
    build_coast,
    coord_banned,
    ensure_low_tier,
    label_anchors,
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


if __name__ == "__main__":
    unittest.main()


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
