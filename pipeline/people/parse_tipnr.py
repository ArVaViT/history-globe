"""Parse TIPNR (STEPBible) into the intermediate tipnr-parsed.json.

A record starts with a "$========== <TYPE>" line, then a header line (tab-separated fields),
then sub-lines "– <Significance>\t<UniqueName>\t<dStrong>\t<Translated>\t<Refs>",
"– Total ...", and descriptions "@Briefest= / @Brief= / @Short= / @Article=".
"""

import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
# STEPBible TIPNR at a fixed commit (CC BY 4.0); fetched once into the pipeline cache and
# never redistributed raw (its header asks not to; docs/legal-questions.md, question 1).
COMMIT = "b99716b0cddb648ddb95cc786a197180f2f97d48"
URL = (
    f"https://raw.githubusercontent.com/STEPBible/STEPBible-Data/{COMMIT}/Proper%20Nouns/"
    "TIPNR%20-%20Translators%20Individualised%20Proper%20Names%20with%20all%20References%20-%20STEPBible.org%20CC%20BY.txt"
)
SRC = ROOT / "pipeline" / ".cache" / "tipnr.txt"
OUT = ROOT / "pipeline" / ".cache" / "people" / "tipnr-parsed.json"

# STEPBible -> OSIS abbreviations (same as the project's pipeline/build_versification.py)
STEP_TO_OSIS = {
    "Gen": "Gen", "Exo": "Exod", "Lev": "Lev", "Num": "Num", "Deu": "Deut", "Jos": "Josh",
    "Jdg": "Judg", "Rut": "Ruth", "1Sa": "1Sam", "2Sa": "2Sam", "1Ki": "1Kgs", "2Ki": "2Kgs",
    "1Ch": "1Chr", "2Ch": "2Chr", "Ezr": "Ezra", "Neh": "Neh", "Est": "Esth", "Job": "Job",
    "Psa": "Ps", "Pro": "Prov", "Ecc": "Eccl", "Sng": "Song", "Isa": "Isa", "Jer": "Jer",
    "Lam": "Lam", "Ezk": "Ezek", "Eze": "Ezek", "Dan": "Dan", "Hos": "Hos", "Jol": "Joel",
    "Amo": "Amos", "Oba": "Obad", "Jon": "Jonah", "Mic": "Mic", "Nam": "Nah", "Hab": "Hab",
    "Zep": "Zeph", "Hag": "Hag", "Zec": "Zech", "Mal": "Mal", "Mat": "Matt", "Mrk": "Mark",
    "Luk": "Luke", "Jhn": "John", "Act": "Acts", "Rom": "Rom", "1Co": "1Cor", "2Co": "2Cor",
    "Gal": "Gal", "Eph": "Eph", "Php": "Phil", "Col": "Col", "1Th": "1Thess", "2Th": "2Thess",
    "1Ti": "1Tim", "2Ti": "2Tim", "Tit": "Titus", "Phm": "Phlm", "Heb": "Heb", "Jas": "Jas",
    "Jam": "Jas", "1Pe": "1Pet", "2Pe": "2Pet", "1Jn": "1John", "2Jn": "2John", "3Jn": "3John",
    "Jud": "Jude", "Rev": "Rev",
}
REF = re.compile(r"(LXX ?)?\b([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)([a-z]?)")
LINK = re.compile(r"\s*([^,+]+?@[^,+\s]*?)(\((?:a|d|f|\?)\))*\s*(?=,|$|\+)")


def refs_of(text: str) -> tuple[list[str], list[str], list[str]]:
    """Return (OSIS verses without LXX, LXX verses, unrecognised books)."""
    main, lxx, bad = [], [], []
    for m in REF.finditer(text):
        book = STEP_TO_OSIS.get(m.group(2))
        if not book:
            bad.append(m.group(0))
            continue
        osis = f"{book}.{int(m.group(3))}.{int(m.group(4))}"
        (lxx if m.group(1) else main).append(osis)
    return main, lxx, bad


def links(field: str) -> list[dict]:
    """'A@Gen.1.1-Rev(a), B@Exo.2.3' -> [{ref, flags}]; empty entries and '>' are dropped."""
    out = []
    for part in re.split(r",", field):
        part = part.strip()
        if not part or part == ">" or "@" not in part:
            continue
        flags = re.findall(r"\((a|d|f|\?)\)", part)
        ref = re.sub(r"\((a|d|f|\?)\)", "", part).strip()
        out.append({"ref": ref, "flags": flags})
    return out


def fetch() -> None:
    if SRC.exists():
        return
    import urllib.request

    SRC.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(URL, headers={"User-Agent": "history-globe-pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        SRC.write_bytes(r.read())


def main() -> None:
    fetch()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    lines = SRC.read_text(encoding="utf-8").splitlines()
    # Skip the documentation header: the data starts after the "ME - an Emendation" line.
    start = next(i for i, l in enumerate(lines) if l.startswith("ME - an Emendation"))
    records, cur, bad_books = [], None, []
    for raw in lines[start:]:
        line = raw.rstrip("\t ").rstrip()
        if line.startswith("$=========="):
            cur = {"kind": line.strip("$= \t"), "head": None, "forms": [], "desc": {}}
            records.append(cur)
            continue
        if cur is None:
            continue
        if line.startswith("    ref_string") or line.startswith("TODO"):
            break  # The file's tail is the authors' working notes.
        if cur["head"] is None:
            cur["head"] = raw.split("\t")
            continue
        if line.startswith("– Total"):
            f = raw.split("\t")
            cur["total_names"] = f[1].strip() if len(f) > 1 else ""
            continue
        if line.startswith("– "):
            f = raw.split("\t")
            sig = f[0][2:].strip()
            text = "\t".join(f[4:])
            main_refs, lxx, bad = refs_of(text)
            bad_books += bad
            cur["forms"].append({
                "significance": sig,
                "unique_name": f[1].strip() if len(f) > 1 else "",
                "dstrong": (f[2].split("«")[0].strip() if len(f) > 2 else ""),
                "translated": f[3].strip() if len(f) > 3 else "",
                "refs": main_refs, "lxx_refs": lxx,
            })
            continue
        m = re.match(r"@(Briefest|Brief|Short|Article)=\s*(.*)", line)
        if m:
            cur["desc"][m.group(1).lower()] = m.group(2).strip()
    out = []
    for r in records:
        h = r["head"] or []
        h += [""] * (9 - len(h))
        uid_full = h[0].strip()
        key, _, ustrong = uid_full.partition("=")
        rec = {
            "kind": r["kind"], "key": key.strip(), "ustrong": ustrong.strip(),
            "name": key.split("@")[0].strip(), "type": h[8].strip(),
            "summary_html": h[7].lstrip("#").strip(),
            "forms": r["forms"], "desc": r["desc"], "total_names": r.get("total_names", ""),
        }
        if r["kind"].startswith("PERSON"):
            fa, _, mo = h[2].partition("+")
            rec.update({
                "description": h[1].strip(),
                "father": links(fa), "mother": links(mo),
                "siblings": links(h[3]), "partners": links(h[4]), "offspring": links(h[5]),
                "tribe": h[6].strip().strip(">").strip(),
            })
        elif r["kind"].startswith("PLACE"):
            coords = None
            m = re.search(r"@(-?[\d.]+),(-?[\d.]+)", h[4])
            if m and not (float(m.group(1)) == 0):
                coords = [float(m.group(2)), float(m.group(1))]  # lon, lat
            fa, _, _ = h[2].partition("+") if r["kind"] == "PLACE+PERSON" else (h[2], "", "")
            rec.update({
                "openbible_name": h[1].strip(),
                "founders": links(h[2].replace("+", ",")),
                "inhabitants": links(h[3]),
                "coords": coords, "area": h[6].strip().strip(">").strip(),
            })
        else:
            rec["description"] = h[1].strip()
        refs = sorted({x for f in r["forms"] for x in f["refs"]})
        rec["refs"] = refs
        rec["lxx_refs"] = sorted({x for f in r["forms"] for x in f["lxx_refs"]})
        out.append(rec)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False))
    from collections import Counter
    print(len(out), Counter((r["kind"], r["type"]) for r in out).most_common())
    print("unknown books:", Counter(b.split(".")[0] for b in bad_books))


if __name__ == "__main__":
    main()
