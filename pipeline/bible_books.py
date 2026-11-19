"""The Bible's books, from pipeline/bible-books.json, which the TypeScript scripts read too."""

import json
import pathlib

_BOOKS = json.loads((pathlib.Path(__file__).resolve().parent / "bible-books.json").read_text(encoding="utf-8"))

# USFM book codes (eBible.org) → OSIS, in the canon's order.
USFM_TO_OSIS: dict[str, str] = _BOOKS["usfm"]
# STEPBible's book abbreviations → OSIS, with the variant spellings TIPNR also uses.
STEP_TO_OSIS: dict[str, str] = _BOOKS["step"]
# The OSIS books in the canon's order.
OSIS_ORDER: list[str] = list(USFM_TO_OSIS.values())
