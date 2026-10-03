"""Check the genealogy.json graph against known lineages.

Writes work/genealogy-check.json and prints a summary.
"""

import json
import pathlib
import re
from collections import defaultdict, deque

HERE = pathlib.Path(__file__).resolve().parent.parent / ".cache" / "people"
G = json.loads((HERE / "genealogy.json").read_text())
P = {p["id"]: p for p in json.loads((HERE / "tipnr-people.json").read_text())["people"]}
children = defaultdict(list)
parents = defaultdict(list)
for e in G["edges"]:
    children[e["from"]].append(e)
    parents[e["to"]].append(e)


def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())


def names(p):
    out = {norm(x) for x in re.split(r" or ", p["names"])} | {norm(p["name"])}
    return out


def find(name, verse):
    hits = [p for p in P.values() if verse in p["refs"] and norm(name) in names(p)]
    if len(hits) != 1:
        hits2 = [p for p in P.values() if verse in p["refs"] and norm(name)[:4] in "".join(names(p))]
        if len(hits) == 0 and len(hits2) == 1:
            return hits2[0]["id"], "fuzzy"
        return (hits[0]["id"] if hits else None), f"{len(hits)} candidates"
    return hits[0]["id"], "ok"


def path(a, b, maxlen=6):
    """Shortest path a -> ... -> b along parent->child edges."""
    q = deque([(a, [a])])
    seen = {a}
    while q:
        x, pth = q.popleft()
        if x == b:
            return pth
        if len(pth) > maxlen:
            continue
        for e in children[x]:
            if e["to"] not in seen:
                seen.add(e["to"])
                q.append((e["to"], pth + [e["to"]]))
    return None


def edge(a, b):
    return next((e for e in children[a] if e["to"] == b), None)


LINES = {
    "Adam -> Noah (Gen 5)": [("Adam", "Gen.5.3"), ("Seth", "Gen.5.3"), ("Enosh", "Gen.5.6"), ("Kenan", "Gen.5.9"),
                             ("Mahalalel", "Gen.5.12"), ("Jared", "Gen.5.15"), ("Enoch", "Gen.5.18"),
                             ("Methuselah", "Gen.5.21"), ("Lamech", "Gen.5.25"), ("Noah", "Gen.5.29")],
    "Noah -> Abraham (Gen 11)": [("Noah", "Gen.5.32"), ("Shem", "Gen.11.10"), ("Arpachshad", "Gen.11.10"),
                                 ("Shelah", "Gen.11.12"), ("Eber", "Gen.11.14"), ("Peleg", "Gen.11.16"),
                                 ("Reu", "Gen.11.18"), ("Serug", "Gen.11.20"), ("Nahor", "Gen.11.22"),
                                 ("Terah", "Gen.11.24"), ("Abram", "Gen.11.26")],
    "Abraham -> Jacob": [("Abraham", "Gen.21.3"), ("Isaac", "Gen.21.3"), ("Jacob", "Gen.25.26")],
    "Judah -> David (Ruth 4)": [("Judah", "Gen.38.1"), ("Perez", "Ruth.4.18"), ("Hezron", "Ruth.4.18"),
                                ("Ram", "Ruth.4.19"), ("Amminadab", "Ruth.4.19"), ("Nahshon", "Ruth.4.20"),
                                ("Salmon", "Ruth.4.20"), ("Boaz", "Ruth.4.21"), ("Obed", "Ruth.4.21"),
                                ("Jesse", "Ruth.4.22"), ("David", "Ruth.4.22")],
    "David -> Solomon": [("David", "2Sam.12.24"), ("Solomon", "2Sam.12.24")],
    "Matthew 1": [("Abraham", "Matt.1.2"), ("Isaac", "Matt.1.2"), ("Jacob", "Matt.1.2"), ("Judah", "Matt.1.2"),
                  ("Perez", "Matt.1.3"), ("Hezron", "Matt.1.3"), ("Ram", "Matt.1.3"), ("Amminadab", "Matt.1.4"),
                  ("Nahshon", "Matt.1.4"), ("Salmon", "Matt.1.4"), ("Boaz", "Matt.1.5"), ("Obed", "Matt.1.5"),
                  ("Jesse", "Matt.1.5"), ("David", "Matt.1.6"), ("Solomon", "Matt.1.6"), ("Rehoboam", "Matt.1.7"),
                  ("Abijah", "Matt.1.7"), ("Asa", "Matt.1.7"), ("Jehoshaphat", "Matt.1.8"), ("Joram", "Matt.1.8"),
                  ("Uzziah", "Matt.1.8"), ("Jotham", "Matt.1.9"), ("Ahaz", "Matt.1.9"), ("Hezekiah", "Matt.1.9"),
                  ("Manasseh", "Matt.1.10"), ("Amos", "Matt.1.10"), ("Josiah", "Matt.1.10"),
                  ("Jechoniah", "Matt.1.11"), ("Shealtiel", "Matt.1.12"), ("Zerubbabel", "Matt.1.12"),
                  ("Abiud", "Matt.1.13"), ("Eliakim", "Matt.1.13"), ("Azor", "Matt.1.13"), ("Zadok", "Matt.1.14"),
                  ("Achim", "Matt.1.14"), ("Eliud", "Matt.1.14"), ("Eleazar", "Matt.1.15"),
                  ("Matthan", "Matt.1.15"), ("Jacob", "Matt.1.15"), ("Joseph", "Matt.1.16"), ("Jesus", "Matt.1.16")],
    "Luke 3 (Adam -> Jesus)": list(reversed([
        ("Jesus", "Luke.3.23"), ("Joseph", "Luke.3.23"), ("Heli", "Luke.3.23"), ("Matthat", "Luke.3.24"),
        ("Levi", "Luke.3.24"), ("Melchi", "Luke.3.24"), ("Jannai", "Luke.3.24"), ("Joseph", "Luke.3.24"),
        ("Mattathias", "Luke.3.25"), ("Amos", "Luke.3.25"), ("Nahum", "Luke.3.25"), ("Esli", "Luke.3.25"),
        ("Naggai", "Luke.3.25"), ("Maath", "Luke.3.26"), ("Mattathias", "Luke.3.26"), ("Semein", "Luke.3.26"),
        ("Josech", "Luke.3.26"), ("Joda", "Luke.3.26"), ("Joanan", "Luke.3.27"), ("Rhesa", "Luke.3.27"),
        ("Zerubbabel", "Luke.3.27"), ("Shealtiel", "Luke.3.27"), ("Neri", "Luke.3.27"), ("Melchi", "Luke.3.28"),
        ("Addi", "Luke.3.28"), ("Cosam", "Luke.3.28"), ("Elmadam", "Luke.3.28"), ("Er", "Luke.3.28"),
        ("Joshua", "Luke.3.29"), ("Eliezer", "Luke.3.29"), ("Jorim", "Luke.3.29"), ("Matthat", "Luke.3.29"),
        ("Levi", "Luke.3.29"), ("Simeon", "Luke.3.30"), ("Judah", "Luke.3.30"), ("Joseph", "Luke.3.30"),
        ("Jonam", "Luke.3.30"), ("Eliakim", "Luke.3.30"), ("Melea", "Luke.3.31"), ("Menna", "Luke.3.31"),
        ("Mattatha", "Luke.3.31"), ("Nathan", "Luke.3.31"), ("David", "Luke.3.31"), ("Jesse", "Luke.3.32"),
        ("Obed", "Luke.3.32"), ("Boaz", "Luke.3.32"), ("Sala", "Luke.3.32"), ("Nahshon", "Luke.3.32"),
        ("Amminadab", "Luke.3.33"), ("Admin", "Luke.3.33"), ("Arni", "Luke.3.33"), ("Hezron", "Luke.3.33"),
        ("Perez", "Luke.3.33"), ("Judah", "Luke.3.33"), ("Jacob", "Luke.3.34"), ("Isaac", "Luke.3.34"),
        ("Abraham", "Luke.3.34"), ("Terah", "Luke.3.34"), ("Nahor", "Luke.3.34"), ("Serug", "Luke.3.35"),
        ("Reu", "Luke.3.35"), ("Peleg", "Luke.3.35"), ("Eber", "Luke.3.35"), ("Shelah", "Luke.3.35"),
        ("Cainan", "Luke.3.36"), ("Arphaxad", "Luke.3.36"), ("Shem", "Luke.3.36"), ("Noah", "Luke.3.36"),
        ("Lamech", "Luke.3.36"), ("Methuselah", "Luke.3.37"), ("Enoch", "Luke.3.37"), ("Jared", "Luke.3.37"),
        ("Mahalaleel", "Luke.3.37"), ("Cainan", "Luke.3.37"), ("Enos", "Luke.3.38"), ("Seth", "Luke.3.38"),
        ("Adam", "Luke.3.38")])),
}

report = {}
for title, seq in LINES.items():
    ids, rows, ok = [], [], 0
    for name, verse in seq:
        pid, how = find(name, verse)
        ids.append(pid)
        if not pid:
            rows.append({"name": name, "verse": verse, "problem": f"not found ({how})"})
    for (a, (na, va)), (b, (nb, vb)) in zip(zip(ids, seq), zip(ids[1:], seq[1:])):
        if not a or not b:
            continue
        e = edge(a, b)
        if e:
            ok += 1
            if e["flags"]:
                rows.append({"pair": f"{na} -> {nb}", "note": f"edge flagged {e['flags']}"})
            continue
        if a == b:
            rows.append({"pair": f"{na} -> {nb}", "problem": "same record"})
            continue
        pth = path(a, b)
        rows.append({"pair": f"{na} -> {nb}", "problem": "no direct edge",
                     "path": [P[x]["name"] + "(" + x.split("@")[1] + ")" for x in pth] if pth else None,
                     "parents_of_child": [e["from"] for e in parents[b]]})
    report[title] = {"people": len(seq), "found": sum(1 for x in ids if x), "direct_edges_ok": ok,
                     "pairs": len(seq) - 1, "issues": rows}
# Jacob's 12 sons
jacob = find("Jacob", "Gen.25.26")[0]
report["Jacob's children"] = sorted(P[e["to"]]["name"] + ("(" + P[e["to"]]["gender"] + ")") for e in children[jacob])
david = find("David", "Ruth.4.22")[0]
report["David's children"] = sorted(P[e["to"]]["name"] for e in children[david])
# Global checks
cyc = []
for e in G["edges"]:
    if path(e["to"], e["from"], 30):
        cyc.append((e["from"], e["to"]))
many = {k: [e["from"] for e in v] for k, v in parents.items()
        if sum(1 for e in v if e["role"] == "father") > 1}
report["_global"] = {
    "cycles": cyc[:20], "children_with_2plus_fathers": len(many),
    "examples_2plus_fathers": dict(list(many.items())[:15]),
    "people_without_parents": sum(1 for p in P if not parents[p]),
    "people_isolated": sum(1 for p in P if not parents[p] and not children[p]),
}
(HERE / "genealogy-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
for t, r in report.items():
    if t.startswith("_") or isinstance(r, list):
        print(t, r if not t.startswith("_") else {k: v for k, v in r.items() if k != "examples_2plus_fathers"})
        continue
    print(f"== {t}: found {r['found']}/{r['people']}, direct edges {r['direct_edges_ok']}/{r['pairs']}")
    for row in r["issues"]:
        print("   ", row)
print(report["_global"]["examples_2plus_fathers"])
