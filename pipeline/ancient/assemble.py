"""Step 7: the wave's content file, content/ancient-sites-wave<WAVE>.json: names no other place
on the map has, in every language Wikidata gives a fitting one, and years fixed by hand where
the periods cannot give them.

    WAVE=2 python3 -I pipeline/ancient/assemble.py <work>

Run after `pnpm data`: the names already taken are read from the built map.
"""

from __future__ import annotations

import collections
import glob
import json
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from ancient.common import ROOT, read  # noqa: E402

# Moved away, or not the ancient place the item is about.
MOVED = re.compile(r"San Vincenzo al Volturno|Dendur|Debod|Taffeh|Ellesy|^Thinis$|Wadi Hammamat", re.I)
# Years the periods cannot give (a town destroyed in the middle of one), from the history
# itself, astronomical: (from or None, to, why).
FIX = {
    "Gamla": (-149, 67, "a town from the 2nd century BC, destroyed by Vespasian in AD 67 (Josephus, Jewish War 4.1)"),
    "Stabiae": (None, 79, "buried by Vesuvius in AD 79"),
    "Helike": (None, -372, "sunk by the earthquake of 373 BC"),
    "Potidaea": (None, -355, "destroyed by Philip II in 356 BC; refounded as Cassandreia"),
    "Luxor Temple": (None, 400, "a temple from Amenhotep III, a Roman camp in the 3rd-4th centuries AD"),
    "Mangup": (500, 1300, "the fortress from the 5th-6th centuries AD, Theodoro until 1475"),
    "Eryx": (-549, 640, "the Elymian sanctuary town; Wikidata's founding (AD 1) is wrong"),
    "Gerf Hussein": (-1269, 640, "the rock temple of Ramesses II, built c. 1270 BC"),
    "Methone": (-732, -353, "the Eretrian colony of c. 733 BC, razed by Philip II in 354 BC"),
    "Kainua": (-549, -350, "the Etruscan town of the late 6th century BC, left after the Gauls came in the 4th"),
    "Phintias": (-281, 300, "founded by Phintias of Akragas c. 282 BC"),
    "Ptolemais Theron": (-269, 300, "founded by Ptolemy II c. 270 BC"),
    "Jebel Khalid": (-299, -69, "the Seleucid fortress, left c. 70 BC"),
    "Segeda": (None, -71, "the Celtiberian town, taken by Rome in 153 BC, its successor left c. 72 BC"),
    "Tyritake": (None, 640, "most accounts end the town c. 370, after the Huns; kept to the last Pleiades period, not Wikidata's 800"),
}

# English labels Wikidata gives in another language or with a note.
RENAME = {
    "Temple romain de Château-Bas": "Temple of Château-Bas",
    "Archeological site of Alba-la-Romaine": "Alba Helviorum",
    "Cala Morell Settlement": "Cala Morell",
    "Portus Magnus, Algeria": "Portus Magnus",
    "Poblat talaiòtic de Montefí": "Montefí",
    "Sa Caleta Phoenician Settlement": "Sa Caleta",
    "Nicaea, Locris": "Nicaea in Locris",
    "Epiphania, Cilicia": "Epiphania in Cilicia",
    "Temple of Janus": "Temple of Janus at Autun",
    "Hosn Niha Site": "Hosn Niha",
    "Ancient Tenea": "Tenea",
    "Ancient Lappa": "Lappa",
    "Gremanu nuraghe sacred place": "Gremanu",
    "Pharsalos ancient city": "Pharsalus",
    "Ancient Tithorea": "Tithorea",
    "Gytheion ancient polis": "Gytheion",
    "Kisamos ancient city": "Kisamos",
    "Mochlos site": "Mochlos",
    "Ciudad romana de Lacipo": "Lacipo",
    "Area archeologica del Castrum Inui": "Castrum Inui",
    "Santuario italico di Schiavi d'Abruzzo": "Sanctuary of Schiavi d'Abruzzo",
    "Poblat ibèric de Can Fatjó": "Can Fatjó",
    "Poblat ibèric de la Cadira del Bisbe": "Cadira del Bisbe",
    "Poblat ibèric de les Maleses": "Les Maleses",
    "Poblat Ibèric del Turó de Castellruf": "Turó de Castellruf",
    "Povoado fortificado e Santuário de Endovélico": "Sanctuary of Endovelicus",
    "Camp celtique de la Bure": "La Bure",
    "Necropolis of Manduria": "Manduria",
    "Minoan villa of Achladia": "Achladia",
    "Üçtepe Mound": "Üçtepe",
    "Agios Konstantinos, Methana": "Sanctuary of Agios Konstantinos",
    "Aventicum, Roman city - Avenches, medieval-modern city": "Aventicum",
    "Castro, Lazio": "Castro",
    "Ancient Maroneia": "Maroneia",
    "Sanctuary of Isthmian Poseidon, Isthmia": "Isthmia",
}

# A name in one language where Wikidata's label names something else: the village it became
# (Helenopolis as «Дрепан»), a later town (Histiaia as «Орей»), a battle (Elegeia), or a name
# too bare to tell it from another (Phthiotic Thebes as «Фивы»).
NAME = {
    ("Helenopolis", "ru"): "Еленополь",
    ("Aegae", "ru"): "Эги Киликийские",
    ("Histiaia", "ru"): "Гистиея",
    ("Roman temple of Vic", "ru"): "Римский храм в Вике",
    ("Serrion Teichos", "ru"): "Серрион-Тейхос",
    ("Elegeia", "ru"): "Элегея",
    ("Forum Novum", "ru"): "Форум Новум",
    ("Temple of Apollo Epicurius in Bassae", "sr"): "Храм Аполона Епикурија",
    ("Haluza", "it"): "Elusa",
    ("Thagaste", "ru"): "Тагаст",
    ("Dardanos", "ru"): "Дардан",
    ("Lavinium", "ru"): "Лавиний",
    ("Beneventum", "ru"): "Беневент",
    ("Koroneia", "ru"): "Коронея",
    ("Marcianopolis", "ru"): "Марцианополь",
    ("Pharae", "ru"): "Феры Мессенские",
    ("Prusias ad Hypium", "ru"): "Прусиада-на-Гипии",
    ("Teuthis", "ru"): "Тевфида",
    ("Tium", "ru"): "Тиос",
    ("Stageira", "ru"): "Стагира",
    ("Histria", "ru"): "Гистрия",
    ("Phthiotic Thebes", "ru"): "Фивы Фтиотидские",
}

# No name in these languages, the English stands: Wikidata's is a modern village, another
# place, a description, or a label in the wrong language.
NO_NAME = {
    "Acropolis of Arpino": {"cs", "da", "es", "fi", "fr", "nb", "pl", "pt", "ro", "sr", "sv", "tl"},
    "Aegae": {"es", "it", "nl", "uk"},
    "Alba Helviorum": {"fr", "nl"},
    "Anthemous": {"sv"},
    "Aventicum": {"de", "fr"},
    "Bakchias": {"sv"},
    "Diocletianopolis in Thrace": {"pl"},
    "Gnatia": {"es"},
    "Haïdra": {"es"},
    "Histiaia": {"es", "nl", "uk"},
    "Iluro": {"es"},
    "Issus": {"nl"},
    "Kandyba": {"vi"},
    "L'Alcúdia": {"es", "sv"},
    "Macistus": {"fi"},
    "Malgium": {"nl"},
    "Manduria": {"fr", "it", "nl"},
    "Olba": {"de"},
    "Panionium": {"nl"},
    "Porto Pisano": {"de"},
    "Raphana": {"nb"},
    "Sa Caleta": {"de"},
    "Scoglietto sanctuary": {"it", "nl"},
    "Sippar-Amnanum": {"fr", "nl", "pl", "sv"},
    "Temple of Château-Bas": {"de", "nl"},
    "Tigranocerta": {"de"},
    "Tintignac": {"it"},
    "Xyniae": {"bg", "sr"},
}

# Kinds Wikidata's classes get wrong.
KIND = {
    "Villa of Herodes Atticus": "site",
    "Necropolis of Pranu Muttedu": "site",
    "Achladia": "site",
}

CYRILLIC = ("ru", "uk", "bg", "sr")
# Cyrillic names where Wikidata has none: ours, as that language's classical scholarship
# writes the place or sound for sound; a Wikidata label wins.
OUR_CYRILLIC = json.loads((ROOT / "pipeline/ancient/names-cyrillic.json").read_text(encoding="utf-8"))
SOURCE = (
    "Ancient sites, wave {wave}: Pleiades (CC BY 3.0) settlements, sanctuaries and ports linked to a Wikidata "
    "item (CC0) that is an ancient site, not a modern town; point from Pleiades; years the span of the periods "
    "Pleiades attests (modern ones left out), so approximate; names from Wikidata labels (in Russian, Ukrainian, "
    "Bulgarian and Serbian, where Wikidata has none, ours: pipeline/ancient/names-cyrillic.json), none that "
    "another place on the map already has. Written by a script; see docs/adr/0018."
)


def clean(name: str) -> str:
    return re.sub(r"\s*\([^)]*\)", "", name).strip()


def names_taken(wave: str) -> dict[str, set[str]]:
    """The names on the map, per language, which a new site never takes (Thebe near Troy as
    «Фивы»): the Bible's places, the first file and the other waves, and content/names-*.yaml."""
    taken: dict[str, set[str]] = collections.defaultdict(set)
    data = ROOT / "apps/web/public/data"
    for f in json.loads((data / "places.geojson").read_text(encoding="utf-8"))["features"]:
        taken["en"].add(f["properties"]["name"])
    for names in json.loads((data / "content.json").read_text(encoding="utf-8"))["names"].values():
        for lang, name in names.items():
            if isinstance(name, str):
                taken[lang].add(name)
    for s in json.loads((ROOT / "content/ancient-sites.json").read_text(encoding="utf-8"))["sites"]:
        taken["en"].add(s["en"])
        taken["ru"].add(s["ru"])
    for path in glob.glob(str(ROOT / "content/ancient-sites-wave*.json")):
        if path.endswith(f"wave{wave}.json"):
            continue
        for s in json.loads(pathlib.Path(path).read_text(encoding="utf-8"))["sites"]:
            taken["en"].add(s["en"])
            for lang, name in s.get("names", {}).items():
                taken[lang].add(name)
    for path in glob.glob(str(ROOT / "content/names-*.yaml")):
        lang = path.rsplit("-", 1)[1][:2]
        text = pathlib.Path(path).read_text(encoding="utf-8")
        for m in re.finditer(r'^\s+"?\d+"?:\s*"?([^"\n]+)"?\s*$', text, re.M):
            taken[lang].add(m.group(1))
    return taken


def names_of(site: dict, en: str, taken: dict[str, set[str]], dropped: collections.Counter) -> dict[str, str]:
    names = {}
    for lang, label in site["names"].items():
        if lang in NO_NAME.get(en, ()):
            continue
        name = clean(NAME.get((en, lang), label))
        # Wikidata's Serbian is now and then in Latin script; the map's Serbian is Cyrillic.
        if lang in CYRILLIC and re.search("[A-Za-z]", name):
            continue
        if name and name not in taken[lang] and name != en:
            names[lang] = name
        elif name in taken[lang]:
            dropped[f"name taken {lang}"] += 1
    for lang, name in OUR_CYRILLIC.get(site["id"], {}).items():
        if lang not in names and name not in taken[lang]:
            names[lang] = name
    return names


def main(work: pathlib.Path) -> None:
    wave = os.environ.get("WAVE", "1")
    taken = names_taken(wave)
    out, dropped = [], collections.Counter()
    for s in sorted(read(work, "wave.json"), key=lambda s: -s["fame"]):
        if MOVED.search(s["en"]):
            dropped["moved"] += 1
            continue
        en = clean(RENAME.get(s["en"], s["en"]))
        if en in taken["en"]:
            dropped["english name taken"] += 1
            continue
        names = names_of(s, en, taken, dropped)
        for lang, name in names.items():
            taken[lang].add(name)
        taken["en"].add(en)
        start, end = s["from_"], s["to"]
        fix = FIX.get(en)
        if fix:
            start, end = fix[0] if fix[0] is not None else start, fix[1]
        years = f"years: the span of the periods Pleiades attests it in ({s['periods']})" + (f"; by hand: {fix[2]}" if fix else "")
        out.append(
            {
                "id": s["id"],
                "en": en,
                **({"names": names} if names else {}),
                "lon": s["lon"],
                "lat": s["lat"],
                "from": start,
                "to": end,
                "approx": True,
                "kind": KIND.get(en, s["kind"]),
                "rank": 1 if s["fame"] >= 12 else 2,
                "sources": [f"https://pleiades.stoa.org/places/{s['id']}", f"https://www.wikidata.org/wiki/{s['qid']}", years],
            }
        )
    out.sort(key=lambda s: s["id"])
    path = ROOT / f"content/ancient-sites-wave{wave}.json"
    path.write_text(json.dumps({"_source": SOURCE.format(wave=wave), "sites": out}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(out), dict(dropped), collections.Counter(s["rank"] for s in out))


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
