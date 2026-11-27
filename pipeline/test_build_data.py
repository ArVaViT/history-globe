# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""Licence rules of the pipeline (ADR 0008). Run: python3 -m unittest discover -s pipeline"""

import json
import math
import pathlib
import unittest

from pipeline.build_data import (
    identification_confidence,
    is_disputed,
    COAST_BBOX,
    banned_lonlats,
    build_coast,
    build_places,
    build_sites,
    load_aliases,
    load_place_points,
    merge_aliases,
    retarget_refs,
    pick_site,
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
    fame_rank,
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

    def test_follows_a_chain_whatever_the_order(self) -> None:
        feats = self.feats() + [
            {"geometry": {"coordinates": [34.91, 30.99]}, "properties": {"id": "bealoth", "coord": "openbible"}}
        ]
        self.assertEqual(move_points(feats, {"bealoth": "dimonah", "dimonah": "dibon"}), 2)
        self.assertEqual(feats[2]["geometry"]["coordinates"], [35.16, 31.30])
        self.assertEqual(feats[2]["properties"]["coord"], "wikidata")

    def test_a_circle_stops_it(self) -> None:
        with self.assertRaises(SystemExit):
            move_points(self.feats(), {"dimonah": "dibon", "dibon": "dimonah"})

    def test_a_cross_reference_takes_the_target_modern_site(self) -> None:
        feats = [
            {
                "geometry": {"coordinates": [34.91, 30.99]},
                "properties": {"id": "baalath-beer", "coord": "openbible", "where": "same place as Bealoth",
                               "where_tpl": "same", "where_ref": "bealoth", "where_ref_text": "Bealoth"},
            },
            {
                "geometry": {"coordinates": [35.01, 31.20]},
                "properties": {"id": "ramah", "coord": "openbible", "where": "Tel Ira", "where_tpl": "name",
                               "where_ref": "m_ira"},
            },
        ]
        move_points(feats, {"baalath-beer": "ramah"})
        own = feats[0]["properties"]
        self.assertEqual(own["where"], "Tel Ira")
        self.assertEqual(own["where_tpl"], "name")
        self.assertEqual(own["where_ref"], "m_ira")
        self.assertNotIn("where_ref_text", own)

    def test_a_modern_site_of_its_own_is_kept(self) -> None:
        feats = self.feats()
        feats[0]["properties"] |= {"where": "Khirbet Dhiban", "where_tpl": "name", "where_ref": "m1"}
        feats[1]["properties"] |= {"where": "Dhiban", "where_tpl": "name", "where_ref": "m2"}
        move_points(feats, {"dimonah": "dibon"})
        self.assertEqual(feats[0]["properties"]["where"], "Khirbet Dhiban")

    def test_a_cross_reference_to_a_cross_reference_is_kept(self) -> None:
        feats = self.feats()
        feats[0]["properties"] |= {"where": "same place as Dibon", "where_tpl": "same", "where_ref": "dibon"}
        feats[1]["properties"] |= {"where": "same place as Dimonah", "where_tpl": "same", "where_ref": "dimonah"}
        move_points(feats, {"dimonah": "dibon"})
        self.assertEqual(feats[0]["properties"]["where"], "same place as Dibon")


def ident(modern_id: str, lonlat: str, score: float, description: str | None = None) -> dict:
    return {
        "id": modern_id,
        "id_source": "modern",
        "description": description or f'<modern id="{modern_id}">{modern_id}</modern>',
        "score": {"time_total": score},
        "resolutions": [res("m_wd", lonlat)],
    }


HUKKOK = {
    "id": "hukkok",
    "friendly_id": "Hukkok",
    "types": ["settlement"],
    "verses": [{"osis": "Josh.19.34"}],
    "identifications": [ident("m_jem", "35.26,32.86", 283), ident("m_yaquq", "35.48,32.88", 142)],
}


class PickSite(unittest.TestCase):
    def test_nothing_chosen_means_none(self) -> None:
        self.assertIsNone(pick_site(HUKKOK, None))
        self.assertIsNone(pick_site(HUKKOK, {"other": "m_yaquq"}))

    def test_picks_the_named_modern_location(self) -> None:
        self.assertEqual(pick_site(HUKKOK, {"hukkok": "m_yaquq"})["id"], "m_yaquq")

    def test_a_location_openbible_does_not_list_stops_it(self) -> None:
        with self.assertRaises(SystemExit):
            pick_site(HUKKOK, {"hukkok": "m_elsewhere"})

    def test_an_ancient_record_is_not_a_site(self) -> None:
        record = dict(HUKKOK, identifications=[{"id": "a1", "id_source": "ancient", "resolutions": [res("m_wd", "35.48,32.88")]}])
        with self.assertRaises(SystemExit):
            pick_site(record, {"hukkok": "a1"})


class BuildPlacesWithChosenSite(unittest.TestCase):
    def setUp(self) -> None:
        import tempfile
        from unittest import mock

        # build_places reads the Wikidata coordinates' cache: an empty one, not the real one.
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch("pipeline.build_data.CACHE", pathlib.Path(self.tmp.name))
        self.patch.start()

    def tearDown(self) -> None:
        self.patch.stop()
        self.tmp.cleanup()

    def test_point_confidence_and_today_line_follow_the_chosen_site(self) -> None:
        places, _, _ = build_places([HUKKOK], MODERN, {}, set(), None, {"hukkok": "m_yaquq"})
        p = places["features"][0]
        self.assertEqual(p["geometry"]["coordinates"], [35.48, 32.88])
        self.assertEqual(p["properties"]["confidence"], 142)
        self.assertEqual((p["properties"]["where"], p["properties"]["where_ref"]), ("m_yaquq", "m_yaquq"))

    def test_of_two_records_on_one_point_the_one_with_an_article_keeps_the_label(self) -> None:
        more = dict(HUKKOK, id="h2", friendly_id="Hukkok 2", verses=[{"osis": "Josh.19.34"}, {"osis": "Josh.19.35"}])
        places, _, _ = build_places([HUKKOK, more], MODERN, {}, set())
        self.assertEqual({f["properties"]["id"] for f in places["features"] if f["properties"].get("dup")}, {"hukkok"})
        places, _, _ = build_places([HUKKOK, more], MODERN, {}, set(), articles={"hukkok"})
        self.assertEqual({f["properties"]["id"] for f in places["features"] if f["properties"].get("dup")}, {"h2"})

    def test_without_a_choice_the_first_identification_is_shown(self) -> None:
        places, _, _ = build_places([HUKKOK], MODERN, {}, set())
        p = places["features"][0]
        self.assertEqual(p["geometry"]["coordinates"], [35.26, 32.86])
        self.assertEqual(p["properties"]["confidence"], 283)

    def test_fame_is_read_from_the_checked_item_not_from_openbibles_link(self) -> None:
        # OpenBible links Aphek of Aram to the article for all the Apheks; content/wikidata.json
        # leaves it out, and the place must not take that item's fame.
        record = dict(HUKKOK, linked_data={"s7cc8b2": {"id": "Q4779536"}})
        fame = {"Q4779536": 80, "Q1": 30}
        unranked, _, _ = build_places([record], MODERN, {}, set(), items={}, fame=fame)
        self.assertEqual(unranked["features"][0]["properties"]["rank"], 3)
        ranked, _, _ = build_places([record], MODERN, {}, set(), items={"hukkok": "Q1"}, fame=fame)
        self.assertEqual(ranked["features"][0]["properties"]["rank"], 2)

    def test_a_region_takes_its_wikidata_point(self) -> None:
        places, _, _ = build_places([HUKKOK], MODERN, {}, set(), region_points={"hukkok": [35.3, 31.7]})
        p = places["features"][0]
        self.assertEqual(p["geometry"]["coordinates"], [35.3, 31.7])
        self.assertEqual(p["properties"]["coord"], "wikidata")

    def test_a_banned_wikidata_point_for_a_region_is_refused(self) -> None:
        with self.assertRaises(SystemExit):
            build_places([HUKKOK], MODERN, {}, set(), region_points={"hukkok": [35.1, 31.1]})

    def test_a_banned_point_is_refused_rather_than_dropped(self) -> None:
        record = dict(HUKKOK, identifications=[ident("m_jem", "35.26,32.86", 283), ident("m_osm", "35.1,31.1", 1)])
        with self.assertRaises(SystemExit):
            build_places([record], MODERN, {}, set(), None, {"hukkok": "m_osm"})


class BuildSitesOnTheMapsPoints(unittest.TestCase):
    @staticmethod
    def ident(description: str, lonlat: str, score: int) -> dict:
        return {"description": description, "resolutions": [res("m_wd", lonlat)], "score": {"time_total": score}}

    def sites(self, record: dict, points: dict) -> list[list[float]]:
        fc, _, _ = build_sites([record], MODERN, points, {"old": "ezion"})
        return [f["geometry"]["coordinates"] for f in fc["features"]]

    def test_same_place_as_x_stands_on_the_maps_x(self) -> None:
        # Elath: OpenBible resolves Ezion-geber to the island; the map has it on the tell.
        elath = {
            "id": "elath",
            "friendly_id": "Elath",
            "identifications": [
                self.ident('<modern id="m_wd">Aqaba</modern>', "35.3,31.3", 700),
                self.ident('another name for <ancient id="ezion">Ezion-geber</ancient>', "35.01,31.01", 100),
                self.ident('within 5 km of <ancient id="old">Ezion-geber</ancient>', "35.02,31.02", 50),
            ],
        }
        points = {"elath": (35.3, 31.3), "ezion": (35.4, 31.4)}
        self.assertEqual(self.sites(elath, points), [[35.3, 31.3], [35.4, 31.4], [35.4, 31.4]])
        # Without the map's points (the first pass) OpenBible's own are kept.
        self.assertEqual(self.sites(elath, {}), [[35.3, 31.3], [35.01, 31.01], [35.02, 31.02]])

    def test_the_shown_candidate_stays_on_the_places_own_point(self) -> None:
        # Cabbon and Machbenah: each "another name" for the other, on two points.
        cabbon = {
            "id": "cabbon",
            "friendly_id": "Cabbon",
            "identifications": [
                self.ident('another name for <ancient id="machbenah">Machbenah</ancient>', "35.1,31.1", 600),
                self.ident('<modern id="m_wd">Khirbet</modern>', "35.6,31.6", 300),
            ],
        }
        points = {"cabbon": (35.11, 31.11), "machbenah": (35.5, 31.5)}
        self.assertEqual(self.sites(cabbon, points), [[35.11, 31.11], [35.6, 31.6]])


class LoadPlacePoints(unittest.TestCase):
    def test_splits_same_as_site_and_wikidata_and_refuses_two_or_none(self) -> None:
        import json
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / "place-points.json"
            path.write_text(
                json.dumps({"places": {"a": {"same_as": "b"}, "c": {"site": "m1", "why": "…"}, "d": {"wikidata": "Q1", "why": "…"}}})
            )
            self.assertEqual(load_place_points(path), ({"a": "b"}, {"c": "m1"}, {"d": "Q1"}))
            path.write_text(json.dumps({"places": {"a": {"same_as": "b", "site": "m1"}}}))
            with self.assertRaises(SystemExit):
                load_place_points(path)
            path.write_text(json.dumps({"places": {"a": {"why": "…"}}}))
            with self.assertRaises(SystemExit):
                load_place_points(path)

    def test_the_real_file_loads_and_every_choice_says_why(self) -> None:
        import json

        path = pathlib.Path(__file__).resolve().parent.parent / "content" / "place-points.json"
        same_as, sites, regions = load_place_points(path)
        places = json.loads(path.read_text(encoding="utf-8"))["places"]
        self.assertEqual(len(same_as) + len(sites) + len(regions), len(places))
        for pid, o in places.items():
            self.assertTrue(o.get("why", "").strip(), f"{pid} has no why")
        # A same_as chain ends at a record that stands on its own point (move_points follows it).
        for pid, target in same_as.items():
            seen = {pid}
            while target in same_as:
                self.assertNotIn(target, seen, f"same_as of {pid} runs in a circle")
                seen.add(target)
                target = same_as[target]


class MergeAliases(unittest.TestCase):
    """One place kept twice by OpenBible becomes one (content/place-aliases.json, ADR 0022)."""

    def verse(self, osis: str) -> dict:
        return {"osis": osis}

    def test_the_place_takes_every_verse_once_in_the_order_of_the_bible(self) -> None:
        ai = {"id": "ai1", "verses": [self.verse("Josh.7.2"), self.verse("Gen.12.8")]}
        ai3 = {"id": "ai3", "verses": [self.verse("Neh.7.32"), self.verse("Josh.7.2"), self.verse("Ezra.2.28")]}
        other = {"id": "x", "verses": [self.verse("Gen.1.1")]}
        records, merged = merge_aliases([ai, ai3, other], {"ai3": "ai1"})
        self.assertEqual([r["id"] for r in records], ["ai1", "x"])
        self.assertEqual([v["osis"] for v in records[0]["verses"]], ["Gen.12.8", "Josh.7.2", "Ezra.2.28", "Neh.7.32"])
        self.assertEqual(merged, {"ai1": ["ai3"]})

    def test_an_unknown_record_stops_the_build(self) -> None:
        with self.assertRaises(SystemExit):
            merge_aliases([{"id": "a", "verses": []}], {"b": "a"})

    def test_a_label_naming_a_retired_record_names_the_place(self) -> None:
        fc = {"features": [{"properties": {"ref": "ai3", "where_ref": "ai3"}}, {"properties": {"ref": "x"}}]}
        retarget_refs([fc], {"ai3": "ai1"})
        self.assertEqual(fc["features"][0]["properties"], {"ref": "ai1", "where_ref": "ai1"})
        self.assertEqual(fc["features"][1]["properties"], {"ref": "x"})

    def test_a_chain_or_a_loop_is_refused(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / "place-aliases.json"
            path.write_text(json.dumps({"places": {"a": {"into": "b"}, "b": {"into": "c"}}}))
            with self.assertRaises(SystemExit):
                load_aliases(path)
            path.write_text(json.dumps({"places": {"a": {"into": "a"}}}))
            with self.assertRaises(SystemExit):
                load_aliases(path)

    def test_the_real_file_loads_and_every_merge_says_why(self) -> None:
        path = pathlib.Path(__file__).resolve().parent.parent / "content" / "place-aliases.json"
        aliases = load_aliases(path)
        places = json.loads(path.read_text(encoding="utf-8"))["places"]
        self.assertEqual(len(aliases), len(places))
        for pid, o in places.items():
            self.assertTrue(o.get("why", "").strip(), f"{pid} has no why")


class Disputed(unittest.TestCase):
    """Disputed: rivals more than 5 km from the leading candidate hold 20 % or more."""

    def cand(self, lon: float, score: float) -> dict:
        return {"lon": lon, "lat": 31.0, "score": score}

    def test_a_far_rival_with_a_fifth_disputes_the_site(self) -> None:
        # 0.1 degree of longitude at 31° N is about 9.5 km.
        self.assertTrue(is_disputed([self.cand(35.0, 80), self.cand(35.1, 20)]))
        self.assertFalse(is_disputed([self.cand(35.0, 81), self.cand(35.1, 19)]))

    def test_a_rival_next_door_does_not(self) -> None:
        # 0.03 degree is under 3 km: a rival site nearby, inside the 5 km.
        self.assertFalse(is_disputed([self.cand(35.0, 50), self.cand(35.03, 50)]))

    def test_minor_far_rivals_count_together(self) -> None:
        cands = [self.cand(35.0, 76), self.cand(35.2, 8), self.cand(35.4, 8), self.cand(35.6, 8)]
        self.assertTrue(is_disputed(cands))

    def test_nothing_rated_stays_disputed(self) -> None:
        self.assertTrue(is_disputed([self.cand(35.0, 0), self.cand(35.1, -5)]))


class Rank(unittest.TestCase):
    def test_thresholds(self) -> None:
        self.assertEqual([rank_of(n) for n in (40, 39, 10, 9, 3, 2)], [0, 1, 1, 2, 2, 3])

    def test_fame_never_makes_a_capital(self) -> None:
        self.assertEqual([fame_rank(n) for n in (500, 60, 59, 25, 24, 0)], [1, 1, 2, 2, 3, 3])


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
        self.patch = mock.patch("pipeline.build_data.CACHE", self.cache)
        self.patch.start()
        self.sources = {"x": {"file": "x.txt", "url": self.upstream.as_uri(), "license": "PD", "credit": ""}}
        self.good = hashlib.sha256(self.upstream.read_bytes()).hexdigest()

    def tearDown(self) -> None:
        import shutil

        self.patch.stop()
        shutil.rmtree(self.tmp)

    def test_downloads_and_keeps_a_file_that_hashes_as_pinned(self) -> None:
        from pipeline.build_data import fetch

        path = fetch("x", self.sources, {"x": {"sha256": self.good}})
        self.assertEqual(path.read_bytes(), self.upstream.read_bytes())
        # A second call reads the cache and checks it again.
        self.assertEqual(fetch("x", self.sources, {"x": {"sha256": self.good}}), path)

    def test_removes_a_download_that_does_not_hash_so_and_stops(self) -> None:
        from pipeline.build_data import fetch

        with self.assertRaises(SystemExit) as stop:
            fetch("x", self.sources, {"x": {"sha256": "0" * 64}})
        self.assertIn("sources.json", str(stop.exception))
        self.assertFalse((self.cache / "x.txt").exists())

    def test_removes_a_cached_file_that_was_changed(self) -> None:
        from pipeline.build_data import fetch

        fetch("x", self.sources, {"x": {"sha256": self.good}})
        (self.cache / "x.txt").write_text("changed on disk\n", encoding="utf-8")
        with self.assertRaises(SystemExit):
            fetch("x", self.sources, {"x": {"sha256": self.good}})
        self.assertFalse((self.cache / "x.txt").exists())

    def test_every_source_is_on_the_licence_allowlist(self) -> None:
        from build_data import ALLOWED_LICENSES, OTHER_SOURCES, SOURCES, check_licences

        for name, src in {**SOURCES, **OTHER_SOURCES}.items():
            self.assertIn(src["license"], ALLOWED_LICENSES, name)
        check_licences(SOURCES, OTHER_SOURCES)
        with self.assertRaises(SystemExit):
            check_licences({"x": {"license": "CC-BY-SA-4.0"}})

    def test_every_source_of_the_build_is_pinned_with_a_hash(self) -> None:
        from pipeline.build_data import PINS, SOURCES

        for name, src in SOURCES.items():
            if src.get("generated"):
                continue
            self.assertIn(name, PINS, name)
            self.assertRegex(PINS[name]["commit"], r"^[0-9a-f]{40}$")
            self.assertRegex(PINS[name]["sha256"], r"^[0-9a-f]{64}$")
            self.assertIn(PINS[name]["commit"], src["url"])


class RiverAtlasLines(unittest.TestCase):
    """The biblical rivers as pipeline/rivers/riveratlas_rivers.py left them in git."""

    HERE = pathlib.Path(__file__).parent / "rivers"
    rivers = {
        f["properties"]["name"]: f
        for f in json.loads((HERE / "rivers.geojson").read_text(encoding="utf-8"))["features"]
    }

    @staticmethod
    def km(a: list[float], b: list[float]) -> float:
        return math.dist([a[0] * math.cos(math.radians(a[1])), a[1]], [b[0] * math.cos(math.radians(b[1])), b[1]]) * 111

    def test_every_target_has_its_line(self) -> None:
        targets = json.loads((self.HERE / "targets.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(t["name"] for t in targets), sorted(self.rivers))

    def test_the_kidron_starts_at_jerusalem_and_reaches_the_dead_sea(self) -> None:
        line = self.rivers["Kidron"]["geometry"]["coordinates"][0]
        self.assertLess(self.km(line[0], [35.236, 31.778]), 3)
        self.assertGreater(line[-1][0], 35.4)

    def test_the_jordan_leaves_the_sea_of_galilee_out(self) -> None:
        upper, lower = self.rivers["Jordan"]["geometry"]["coordinates"]
        self.assertLess(self.km(upper[0], [35.652, 33.249]), 5)  # Dan
        self.assertGreater(upper[-1][1], 32.85)
        self.assertLess(lower[0][1], 32.75)
        self.assertLess(lower[-1][1], 31.8)  # the Dead Sea's north shore

    def test_the_nile_meets_both_delta_branches(self) -> None:
        ends = [line[-1] for line in self.rivers["Nile"]["geometry"]["coordinates"]]
        self.assertIn([31.237, 30.124], ends)  # Rosetta
        self.assertIn([31.145, 30.175], ends)  # Damietta

    def test_a_disputed_place_is_drawn_unnamed(self) -> None:
        self.assertTrue(self.rivers["Brook of Egypt"]["properties"].get("unlabelled"))


if __name__ == "__main__":
    unittest.main()
