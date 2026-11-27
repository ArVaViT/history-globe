# SPDX-License-Identifier: AGPL-3.0-or-later
# Additional terms under section 7: see LICENSING.md

"""Wikidata classes (English labels) that make an item an ancient site, and those that make it a
modern place too; shared by select.py and fame.py."""

import re

ANC = {
    "archaeological site",
    "ancient city",
    "polis",
    "archaeological park",
    "Ancient Greek archaeological site",
    "Roman city",
    "former settlement",
    "tell",
    "Egyptian temple",
    "ancient Greek temple",
    "hieron",
    "temple",
    "deme",
    "ancient Roman structure",
    "castrum",
    "ruins",
    "Roman temple",
    "city-state",
    "submerged settlement",
    "Roman colony",
    "Greek colony",
    "municipium",
    "Roman archaeological site",
    "Celtic archaeological site",
    "oppidum",
    "lost city",
    "organized archaeological site",
    "Ancient Egyptian archaeological site",
    "Heraion",
    "prehistoric archaeological site",
    "roman ruins",
    "Carthaginian archaeological site",
    "ancient port",
    "oracle",
    "abandoned village",
    "City-kingdom of Cyprus",
    "celtiberian town",
    "sanctuary",
    "Neolithic settlement",
    "talaiotic village",
    "hillfort",
    "Gallo-Roman city",
    "Gallo-Roman archaeological site",
    "Etruscan temple",
    "Asclepeion",
    "Necromanteion",
    "destroyed city",
    "destroyed settlement",
    "settlement site",
    "iberian settlement",
    "vicus",
    "civitas",
    "Civitas foederata",
    "colonia augusta",
    "acropolis",
    "Romano-Celtic temple",
    "proto-city",
    "cave city",
    "mithraeum",
    "zona arqueológica",
}
MOD = re.compile(
    r"municipal|commune|comune|frazione|\bcity\b|\btown\b|village|populated place|"
    r"seat|capital|district|mahalle|neighborhood|kmetstvo|městys|freguesia|"
    r"museum|castle|church|monastery|mountain|cave|island|islet|"
    r"national park|resort|nature reserve|protected area|plateau|hill$|mountain pass|oasis|"
    r"administrative|historical country",
    re.I,
)
