# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""Constants the pipeline keeps in step with the TypeScript that owns them."""

import pathlib
import re
import unittest

from pipeline.build_data import YEAR_MAX, YEAR_MIN
from pipeline.build_dataset import LANGS

ROOT = pathlib.Path(__file__).resolve().parent.parent


def ts(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class Mirrored(unittest.TestCase):
    def test_the_dataset_has_every_published_language(self):
        """LANGS (build_dataset.py) are LOCALES (packages/model/src/locales.ts), English first."""
        block = re.search(r"export const LOCALES = \[(.*?)\]", ts("packages/model/src/locales.ts"), re.S)
        assert block
        self.assertEqual(LANGS[0], "en")
        self.assertEqual(sorted(LANGS), sorted(re.findall(r'"([a-z]{2})"', block.group(1))))

    def test_the_period_is_the_maps(self):
        """YEAR_MIN and YEAR_MAX are the engine's (packages/core/src/engine.ts, ADR 0003)."""
        engine = ts("packages/core/src/engine.ts")
        bounds = [int(re.search(rf"export const {k} = (-?\d+);", engine).group(1)) for k in ("YEAR_MIN", "YEAR_MAX")]  # type: ignore[union-attr]
        self.assertEqual([YEAR_MIN, YEAR_MAX], bounds)

    def test_the_dataset_links_to_the_site(self):
        """The dataset's default address is SITE_ORIGIN (packages/model/src/site.ts)."""
        host = re.search(r'export const SITE_HOST = "([^"]+)";', ts("packages/model/src/site.ts"))
        default = re.search(r'os\.environ\.get\("SITE_URL", "([^"]+)"\)', (ROOT / "pipeline/build_dataset.py").read_text())
        assert host and default
        self.assertEqual(default.group(1), f"https://{host.group(1)}")


if __name__ == "__main__":
    unittest.main()
