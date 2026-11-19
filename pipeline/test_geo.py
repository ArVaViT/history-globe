"""Douglas–Peucker and the distances it measures by (pipeline/geo.py)."""

import sys
import unittest

from geo import line_distance, segment_distance, simplify


class Simplify(unittest.TestCase):
    def test_a_straight_line_keeps_its_ends(self):
        self.assertEqual(simplify([(0, 0), (1, 0.001), (2, 0), (3, 0)], 0.1), [(0, 0), (3, 0)])

    def test_a_corner_beyond_the_tolerance_stays(self):
        self.assertEqual(simplify([(0, 0), (5, 5), (10, 0)], 1), [(0, 0), (5, 5), (10, 0)])

    def test_a_line_deeper_than_the_stack_needs_no_recursion(self):
        # Each chord of a zigzag splits off one point: recursion would go 1500 calls deep.
        zigzag = [(x, x % 2) for x in range(1500)]
        limit = sys.getrecursionlimit()
        sys.setrecursionlimit(100)
        try:
            self.assertEqual(len(simplify(zigzag, 0.5)), len(zigzag))
        finally:
            sys.setrecursionlimit(limit)

    def test_the_two_distances_differ_beyond_the_ends_of_the_segment(self):
        self.assertAlmostEqual(line_distance((5, 1), (0, 0), (1, 0)), 1)
        self.assertAlmostEqual(segment_distance((5, 1), (0, 0), (1, 0)), 17**0.5)
        self.assertAlmostEqual(segment_distance((0, 3), (0, 0), (0, 0)), 3)


if __name__ == "__main__":
    unittest.main()
