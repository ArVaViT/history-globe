# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""The people package (pipeline/people)."""

import unittest

from pipeline.people.package import unnamed


class People(unittest.TestCase):
    def test_records_for_people_the_text_does_not_name(self):
        self.assertTrue(unnamed("daughter_of_Lot@Gen.19.30"))
        self.assertTrue(unnamed("Jerusalem_wives@2Sa.5.13"))
        self.assertFalse(unnamed("David@Rut.4.17-Rev"))


if __name__ == "__main__":
    unittest.main()
