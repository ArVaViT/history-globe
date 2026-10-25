"""The Hugging Face dataset build (pipeline/build_dataset.py). Run: python3 -m unittest discover -s pipeline"""

import json
import pathlib
import tempfile
import unittest

from build_dataset import build, certainty, renumber, snapshot_date, TABLES, write_table, year_label


class Years(unittest.TestCase):
    def test_astronomical_years_in_words(self):
        self.assertEqual(year_label(-585, False), "586 BC")
        self.assertEqual(year_label(0, False), "1 BC")
        self.assertEqual(year_label(1, False), "AD 1")
        self.assertEqual(year_label(-1069, True), "c. 1070 BC")
        self.assertEqual(year_label(None, True), "")


class Certainty(unittest.TestCase):
    def test_as_the_place_card_says(self):
        self.assertEqual(certainty(True, 950), "disputed")
        self.assertEqual(certainty(False, 800), "settled")
        self.assertEqual(certainty(False, 799), "most likely")
        self.assertEqual(certainty(False, 600), "most likely")
        self.assertEqual(certainty(False, 599), "tentative")
        self.assertEqual(certainty(False, None), "")


class Ranks(unittest.TestCase):
    def test_no_gaps_within_a_place(self):
        rows = [{"place_id": "a1", "rank": 1}, {"place_id": "a1", "rank": 3}, {"place_id": "a2", "rank": 2}]
        renumber(rows)
        self.assertEqual([r["rank"] for r in rows], [1, 2, 1])


def place(pid, name, verses, **kw):
    return {"id": pid, "name": name, "kind": "settlement", "lon": 35.0, "lat": 31.0, "verses": verses, "names": {"ru": name}, **kw}


def feature(pid, **props):
    return {"geometry": {"coordinates": [35.0, 31.0]}, "properties": {"id": pid, **props}}


class Build(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.dir.name)
        self.api, self.data = root / "api", root / "data"
        (self.api / "verses").mkdir(parents=True)
        self.data.mkdir()
        self.files = {
            "index.json": {"books": ["Josh"], "built_at": "2026-10-24T00:00:00+00:00"},
            "places.json": [place("a1", "Jericho", 1), place("a2", "Jericho", 0, page={"en": "/en/place/jericho/"})],
            "verses/Josh.json": {"Josh.2.1": ["a1"]},
            "people.json": [],
            "events.json": [{"id": "e1", "year": -1400, "title": {"en": "Fall  of Jericho"}, "place": "a1"}],
            "battles.json": [],
            "tours.json": [],
            "ancient.json": {},
        }
        self.places = [feature("a1", where="Tell es-Sultan", confidence=900), feature("a2", where_tpl="same", where_ref="a1")]

    def tearDown(self):
        self.dir.cleanup()

    def run_build(self):
        for name, value in self.files.items():
            (self.api / name).write_text(json.dumps(value), encoding="utf-8")
        (self.data / "places.geojson").write_text(json.dumps({"features": self.places}), encoding="utf-8")
        (self.data / "sites.geojson").write_text(
            json.dumps({"features": [{"geometry": {"coordinates": [35.4, 31.8]}, "properties": {"place": "a1", "rank": 0, "label": "Tell es-Sultan", "share": 100}}]}),
            encoding="utf-8",
        )
        return build(self.api, self.data)

    def test_tables_and_counts(self):
        tables, counts, _ = self.run_build()
        places = {r["id"]: r for r in tables["places"][1]}
        self.assertEqual(places["a1"]["certainty"], "settled")
        self.assertEqual(places["a2"]["same_as"], "a1")
        self.assertEqual(places["a2"]["url"], "https://historyglobe.app/en/place/jericho/")
        self.assertEqual(places["a1"]["url"], "https://historyglobe.app/?place=a1")
        self.assertEqual(tables["events"][1][0]["title_en"], "Fall of Jericho")  # a canary's extra space folded
        self.assertEqual(tables["events"][1][0]["date"], "1401 BC")
        self.assertEqual((counts["places"], counts["no_verse"], counts["pages"]), ("2", "1", "1"))
        self.assertEqual(set(TABLES), set(tables))

    def test_a_verse_count_that_does_not_match_stops_the_build(self):
        self.files["verses/Josh.json"] = {"Josh.2.1": ["a1", "a9"]}
        problems = self.run_build()[2]
        self.assertIn("verse Josh.2.1 names unknown place a9", problems)

    def test_map_data_from_another_release_stops_the_build(self):
        self.places[0]["geometry"]["coordinates"] = [35.1, 31.0]
        self.assertIn("point differs for a1", self.run_build()[2])


class Snapshot(unittest.TestCase):
    def test_keeps_the_published_date_when_nothing_changed(self):
        with tempfile.TemporaryDirectory() as d:
            out, pub = pathlib.Path(d, "out"), pathlib.Path(d, "pub")
            for root in (out, pub):
                (root / "data").mkdir(parents=True)
                for t in TABLES:
                    write_table(root / "data" / f"{t}.csv", ["id"], [{"id": "a1"}])
            (pub / "README.md").write_text("This is a snapshot of 3 May 2026. The API", encoding="utf-8")
            self.assertEqual(snapshot_date(out, pub), "3 May 2026")
            write_table(out / "data" / "places.csv", ["id"], [{"id": "a2"}])
            self.assertNotEqual(snapshot_date(out, pub), "3 May 2026")
            self.assertNotEqual(snapshot_date(out, None), "3 May 2026")


if __name__ == "__main__":
    unittest.main()
