"""Licence rules of the pipeline (ADR 0008). Run: python3 -m unittest discover pipeline"""

import unittest

from build_data import banned_lonlats, coord_banned, rank_of, site_label

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


if __name__ == "__main__":
    unittest.main()
