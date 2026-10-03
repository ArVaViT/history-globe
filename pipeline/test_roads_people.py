"""The Roman roads build (pipeline/roads) and the people package (pipeline/people).
Run: python3 -m unittest discover -s pipeline"""

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "roads"))
sys.path.insert(0, os.path.join(HERE, "people"))

from build_roads import clip_line, dp, fwd, inv, merge, stitch  # noqa: E402
from package import unnamed  # noqa: E402


class Projection(unittest.TestCase):
    def test_world_mercator_round_trip(self):
        # Rome, Jerusalem, Babylon, the map's corners: back to the same point.
        for lon, lat in [(12.48, 41.89), (35.23, 31.78), (44.42, 32.54), (-12, 8), (75, 50)]:
            x, y = fwd(lon, lat)
            lon2, lat2 = inv(x, y)
            self.assertAlmostEqual(lon, lon2, places=9)
            self.assertAlmostEqual(lat, lat2, places=9)


class Clip(unittest.TestCase):
    def test_keeps_the_part_inside_the_box(self):
        pieces = clip_line([(-5, 5), (5, 5), (15, 5)], 0, 0, 10, 10)
        self.assertEqual(pieces, [[(0, 5), (5, 5), (10, 5)]])

    def test_a_line_wholly_outside_gives_nothing(self):
        self.assertEqual(clip_line([(20, 20), (30, 30)], 0, 0, 10, 10), [])

    def test_a_line_that_leaves_and_comes_back_is_two_pieces(self):
        pieces = clip_line([(2, 5), (15, 5), (15, 6), (2, 6)], 0, 0, 10, 10)
        self.assertEqual(len(pieces), 2)


class Simplify(unittest.TestCase):
    def test_a_straight_line_keeps_its_ends(self):
        self.assertEqual(dp([(0, 0), (1, 0.001), (2, 0), (3, 0)], 0.1), [(0, 0), (3, 0)])

    def test_a_corner_beyond_the_tolerance_stays(self):
        self.assertEqual(dp([(0, 0), (5, 5), (10, 0)], 1), [(0, 0), (5, 5), (10, 0)])


class Stitch(unittest.TestCase):
    def test_lines_meeting_end_to_end_become_one(self):
        self.assertEqual(stitch([[(0, 0), (1, 0)], [(1, 0), (2, 0)]]), [[(0, 0), (1, 0), (2, 0)]])

    def test_a_line_drawn_the_other_way_is_turned(self):
        self.assertEqual(stitch([[(0, 0), (1, 0)], [(2, 0), (1, 0)]]), [[(0, 0), (1, 0), (2, 0)]])

    def test_lines_that_do_not_meet_stay_apart(self):
        self.assertEqual(len(stitch([[(0, 0), (1, 0)], [(5, 5), (6, 5)]])), 2)


class Merge(unittest.TestCase):
    def feature(self, name, ids, coords):
        props = {"name": name, "type": "major", "cert": "certain", "ids": ids}
        return {"properties": props, "geometry": {"type": "LineString", "coordinates": coords}}

    def test_segments_of_one_road_are_one_feature(self):
        out = merge(
            [
                self.feature("Via Maris", [7], [[1, 0], [2, 0]]),
                self.feature("Via Maris", [3], [[0, 0], [1, 0]]),
                self.feature("Kings' Highway", [5], [[9, 9], [9, 8]]),
            ]
        )
        self.assertEqual([f["properties"]["name"] for f in out], ["Via Maris", "Kings' Highway"])
        self.assertEqual(out[0]["properties"]["ids"], [3, 7])
        self.assertEqual(out[0]["geometry"]["type"], "LineString")


class People(unittest.TestCase):
    def test_records_for_people_the_text_does_not_name(self):
        self.assertTrue(unnamed("daughter_of_Lot@Gen.19.30"))
        self.assertTrue(unnamed("Jerusalem_wives@2Sa.5.13"))
        self.assertFalse(unnamed("David@Rut.4.17-Rev"))


if __name__ == "__main__":
    unittest.main()
