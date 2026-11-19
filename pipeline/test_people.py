"""The people package (pipeline/people)."""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "people"))

from package import unnamed  # noqa: E402


class People(unittest.TestCase):
    def test_records_for_people_the_text_does_not_name(self):
        self.assertTrue(unnamed("daughter_of_Lot@Gen.19.30"))
        self.assertTrue(unnamed("Jerusalem_wives@2Sa.5.13"))
        self.assertFalse(unnamed("David@Rut.4.17-Rev"))


if __name__ == "__main__":
    unittest.main()
