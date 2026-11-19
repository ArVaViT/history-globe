"""The wave scripts of pipeline/ancient: their years, kinds and names, and two steps run on a
small work directory, without the network."""

import collections
import contextlib
import csv
import io
import gzip
import json
import pathlib
import tempfile
import unittest

from pipeline.ancient import assemble, periods, select
from pipeline.ancient.candidates import in_focus
from pipeline.ancient.common import PLACES_CSV, read


class Years(unittest.TestCase):
    def test_pleiades_calendar_years_become_astronomical(self):
        self.assertEqual([select.astronomical(y) for y in (-750, -1, 0, 30)], [-749, 0, 0, 30])

    def test_a_wikidata_year_moves_only_when_held_to_a_century(self):
        self.assertEqual(periods.wikidata_year("-0752-01-01T00:00:00Z|9"), -752)
        self.assertEqual(periods.wikidata_year("-0500-01-01T00:00:00Z|7"), -499)
        self.assertEqual(periods.wikidata_year("+0260-01-01T00:00:00Z|9"), 260)
        self.assertIsNone(periods.wikidata_year("unknown"))

    def test_modern_and_late_periods_give_no_span_and_unknown_ones_are_counted(self):
        unknown = collections.Counter()
        spans = periods.ancient_spans("roman, modern, ottoman, late-antique, no-such-period", unknown)
        self.assertEqual(spans, [(-29, 300), (301, 640)])
        self.assertEqual(unknown, {"no-such-period": 1})

    def test_wikidata_narrows_the_span_and_never_widens_it(self):
        # Glanum, destroyed c. 260, in periods to 640: it ends then.
        self.assertEqual(periods.narrowed(-549, 640, {"P576": ["+0260-01-01T00:00:00Z|9"]}), (-549, 260))
        # A founding before the first period is the district's, not the town's.
        self.assertEqual(periods.narrowed(-549, 640, {"P571": ["-1000-01-01T00:00:00Z|9"]}), (-549, 640))
        # An end up to 250 years past the last period is taken: Kamarina, burned in 853.
        self.assertEqual(periods.narrowed(-599, 640, {"P576": ["+0853-01-01T00:00:00Z|9"]}), (-599, 853))
        self.assertEqual(periods.narrowed(-599, 640, {"P576": ["+0900-01-01T00:00:00Z|9"]}), (-599, 640))


class KindsAndNames(unittest.TestCase):
    def test_kind(self):
        self.assertEqual(select.kind_of({"temple"}, set()), "sanctuary")
        self.assertEqual(select.kind_of({"settlement", "temple"}, set()), "city")
        self.assertEqual(select.kind_of({"settlement"}, {"oracle"}), "sanctuary")
        self.assertEqual(select.kind_of({"port", "settlement"}, set()), "port")
        self.assertEqual(select.kind_of({"fort"}, set()), "site")

    def test_english_name_loses_the_archaeologists_words(self):
        self.assertEqual(select.english_name("archaeological site of olympia"), "Olympia")

    def test_focus(self):
        self.assertTrue(in_focus(35.2, 31.8))  # Jerusalem
        self.assertFalse(in_focus(-0.1, 51.5))  # London

    def test_a_name_is_taken_once_never_in_latin_script_where_the_map_writes_cyrillic(self):
        taken = collections.defaultdict(set, {"de": {"Theben"}})
        dropped = collections.Counter()
        site = {"id": "1", "names": {"sr": "Tebe", "de": "Theben", "fr": "Thèbes (Grèce)", "ru": "Фивы"}}
        names = assemble.names_of(site, "Thebes", taken, dropped)
        self.assertEqual(names, {"fr": "Thèbes", "ru": "Фивы"})
        self.assertEqual(dropped, {"name taken de": 1})

    def test_a_language_without_a_name_keeps_the_english(self):
        site = {"id": "1", "names": {"de": "Aventicum (Avenches)", "it": "Aventicum"}}
        names = assemble.names_of(site, "Aventicum", collections.defaultdict(set), collections.Counter())
        self.assertEqual(names, {})


class Steps(unittest.TestCase):
    """select.py and periods.py on a work directory of two candidates."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.work = pathlib.Path(self.tmp.name)
        (self.work / "wave").mkdir()
        (self.work / PLACES_CSV).parent.mkdir()
        candidate = {"lon": 26.24, "lat": 39.96, "types": ["settlement"], "min": "-3000", "max": "1453", "periods": ""}
        for name, value in {
            "candidates.json": [
                {**candidate, "pid": "550595", "qid": "Q22647", "fame": 90, "title": "Ilion"},
                {**candidate, "pid": "550596", "qid": "Q1", "fame": 9, "title": "Ilion nearby", "lon": 26.25},
            ],
            "wd.json": {
                "Q22647": {"p31": ["Q839954"], "labels": {"en": "archaeological site of Troy", "ru": "Троя"}},
                "Q1": {"p31": ["Q839954"], "labels": {}},
            },
            "classes.json": {"Q839954": "archaeological site"},
        }.items():
            (self.work / "wave" / name).write_text(json.dumps(value), encoding="utf-8")
        with gzip.open(self.work / PLACES_CSV, "wt", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["id", "timePeriodsKeys"])
            w.writeheader()
            w.writerow({"id": "550595", "timePeriodsKeys": "bronze-age,roman,modern"})

    def tearDown(self):
        self.tmp.cleanup()

    def test_one_site_per_three_km_then_its_years(self):
        with contextlib.redirect_stdout(io.StringIO()):
            select.main(self.work)
        wave = read(self.work, "wave.json")
        self.assertEqual([(s["id"], s["en"], s["from_"], s["to"]) for s in wave], [("550595", "Troy", -2999, 1300)])
        with contextlib.redirect_stdout(io.StringIO()):
            periods.main(self.work)
        self.assertEqual([(s["from_"], s["to"]) for s in read(self.work, "wave.json")], [(-3299, 300)])


if __name__ == "__main__":
    unittest.main()
