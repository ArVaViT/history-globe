"""Build the outputs from work/tipnr-parsed.json + the project's places.geojson (read-only).

Output (into this folder): tipnr-people.json, tipnr-places-match.json, place-people.json,
genealogy.json, work/stats.json (figures for REPORT.md).
"""

import json
import math
import pathlib
import re
from collections import Counter, defaultdict

PROJECT = pathlib.Path(__file__).resolve().parent.parent.parent
HERE = PROJECT / "pipeline" / ".cache" / "people"
PLACES = PROJECT / "apps/web/public/data/places.geojson"
VERSIF = PROJECT / "packages/model/src/versification.ts"

recs = json.loads((HERE / "tipnr-parsed.json").read_text())
by_key = {r["key"]: r for r in recs}
stats: dict = {}

# ---------- resolving "Name@Ref-Book" references -> record key ----------
by_first: dict[str, list[str]] = defaultdict(list)
for r in recs:
    name, _, rest = r["key"].partition("@")
    by_first[f"{name}@{rest.split('-')[0]}"].append(r["key"])
unresolved: list = []


def resolve(ref: str, ctx: str) -> str | None:
    x = ref.split("=")[0].strip()
    for cand in (x, x.rstrip("-–")):
        if cand in by_key:
            return cand
    if "@" in x:
        name, _, rest = x.partition("@")
        hits = by_first.get(f"{name}@{rest.split('-')[0]}", [])
        if len(hits) == 1:
            return hits[0]
    unresolved.append((ctx, ref))
    return None


# ---------- project versification ----------
verses_ts = VERSIF.read_text()
VERSES = {}
for m in re.finditer(r"\n  \"?([0-9A-Za-z]+)\"?: \[([\d,\s]+)\]", verses_ts):
    VERSES[m.group(1)] = [int(x) for x in re.findall(r"\d+", m.group(2))]
BOOK_ORDER = list(VERSES)
NT_START = BOOK_ORDER.index("Matt")


def verse_ok(osis: str) -> bool:
    b, c, v = osis.split(".")
    ch = VERSES.get(b)
    return bool(ch) and 1 <= int(c) <= len(ch) and 1 <= int(v) <= ch[int(c) - 1]


def sort_key(osis: str):
    b, c, v = osis.split(".")
    return (BOOK_ORDER.index(b) if b in BOOK_ORDER else 99, int(c), int(v))


all_refs = {x for r in recs for x in r["refs"]}
bad_refs = sorted(x for x in all_refs if not verse_ok(x))
stats["versification"] = {
    "distinct_refs": len(all_refs),
    "outside_project_table": len(bad_refs),
    "examples": bad_refs[:40],
    "lxx_only_refs_skipped": sum(len(r["lxx_refs"]) for r in recs),
}

# ---------- people ----------
ERA = re.compile(r"living (?:at the time of|at the time before) (?:the )?([^,<]+?)(?:,| first| only|$)")
people = [r for r in recs if r["kind"].startswith("PERSON") and r["type"] in ("Male", "Female")]
groups = [r for r in recs if r["kind"].startswith("PERSON") and r["type"] == "Group"]
places_t = [r for r in recs if r["kind"].startswith("PLACE")]
place_keys = {p["key"] for p in places_t}
person_keys = {p["key"] for p in people}


def anonymous(key: str) -> bool:
    n = key.split("@")[0]
    return n.startswith("Unnamed") or "_of_" in n or n.startswith("wife_") or n.startswith("husband_")


def life_refs(p: dict) -> tuple[list[str], str]:
    """Verses about the person himself, not about the tribe or nation named after him.

    1) drop the Group/Form entries (Jews, Israelite...);
    2) eponyms of the patriarchal era (Jacob=Israel, Jacob's sons, Ephraim, Manasseh...)
       are merged with their tribe/nation in TIPNR, so keep only Gen and Exod 1–6;
    3) for everyone else, keep the "books of life": books holding >=5% of the person's
       verses and >=2 verses (this cuts retrospective mentions like "the law of Moses"
       in Nehemiah).
    """
    refs = set()
    for f in p["forms"]:
        if f["significance"] in ("Group", "Form (verb)", "Form (adjective)"):
            continue
        refs.update(f["refs"])
    note = ""
    has_group = any(f["significance"] == "Group" for f in p["forms"])
    tribal = any(f["ref"].split("=")[0].rstrip("-") in ("Israel@Gen.25.26-Rev", "Joseph@Gen.30.24-Rev")
                 for f in p["father"])  # Jacob's and Joseph's sons = tribes
    eponym = tribal or (("the Patriarchs" in p["description"]) and
                        (has_group or any("d" in o["flags"] for o in p["offspring"]) or len(p["refs"]) > 40))
    if eponym:
        refs = {x for x in refs if x.startswith("Gen.") or (x.startswith("Exod.") and int(x.split(".")[1]) <= 6)}
        note = "eponym: Gen+Exod1-6 only"
    elif len(refs) >= 20:
        cnt = Counter(x.split(".")[0] for x in refs)
        books = {b for b, n in cnt.items() if n >= 2 and n / len(refs) >= 0.05}
        dropped = {x for x in refs if x.split(".")[0] not in books}
        if dropped:
            refs -= dropped
            note = f"life books: {','.join(sorted(books, key=BOOK_ORDER.index))}"
    return sorted(refs, key=sort_key), note


life = {}
for p in people:
    life[p["key"]] = life_refs(p)

# How many named entities (people + places) each verse has: a measure of "list-ness".
ent_in_verse: dict[str, set] = defaultdict(set)
for r in people + places_t:
    for x in r["refs"]:
        ent_in_verse[x].add(r["key"])


ent_in_chapter: dict[str, set] = defaultdict(set)
for v, ks in ent_in_verse.items():
    ent_in_chapter[v.rsplit(".", 1)[0]].update(ks)
LIST_DENSITY = 2.0  # distinct names/verse in chapter: 1 Chr 1-9, Josh 15, Neh 3, Matt 1, Luke 3...
LIST_CHAPTERS = {c for c, ks in ent_in_chapter.items()
                 if len(ks) / VERSES[c.split(".")[0]][int(c.split(".")[1]) - 1] >= LIST_DENSITY}


def w(verse: str) -> float:
    n = len(ent_in_verse.get(verse, ()))
    base = 1.0 if n <= 9 else 0.5 if n <= 14 else 0.2
    return base * (0.3 if verse.rsplit(".", 1)[0] in LIST_CHAPTERS else 1.0)


# ---------- our places and matching ----------
gj = json.loads(PLACES.read_text())
ours = [f["properties"] | {"coords": f["geometry"]["coordinates"] if f.get("geometry") else None}
        for f in gj["features"]]
our_by_id = {o["id"]: o for o in ours}


def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


def tipnr_names(t: dict) -> set[str]:
    names = {norm(t["name"]), norm(re.sub(r"_?Mount$", "", t["name"]))}
    if t.get("openbible_name"):
        ob = re.split(r"[=(]", t["openbible_name"])[0]
        names.add(norm(re.sub(r"_\d+$", "", ob.strip())))
    for part in re.split(r" or ", t.get("total_names", "")):
        names.add(norm(part))
    for f in t["forms"]:
        names.add(norm(f["unique_name"].split("|")[0].split("@")[0]))
        for tr in re.split(r"[;,]", f["translated"]):
            names.add(norm(tr.split("=")[0]))
    names.discard("")
    return names


def km(a, b) -> float | None:
    if not a or not b:
        return None
    (lo1, la1), (lo2, la2) = a, b
    p = math.pi / 180
    h = (math.sin((la2 - la1) * p / 2) ** 2 +
         math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2)
    return round(12742 * math.asin(math.sqrt(h)), 1)


t_sets = {t["key"]: set(t["refs"]) for t in places_t}
t_names = {t["key"]: tipnr_names(t) for t in places_t}
t_ob = {t["key"]: norm(re.sub(r"_\d+$", "", re.split(r"[=(]", t.get("openbible_name") or "")[0].strip()))
        for t in places_t}
verse_to_t: dict[str, set] = defaultdict(set)
for k, s in t_sets.items():
    for x in s:
        verse_to_t[x].add(k)

def candidates(o):
    vp = set(o["osis"])
    cands = Counter()
    for x in vp:
        for k in verse_to_t.get(x, ()):
            cands[k] += 1
    nm = norm(o["name"])
    nm2 = norm(re.sub(r"^Mount ", "", o["name"]))
    for k, names in t_names.items():
        if (nm in names or nm2 in names) and k not in cands:
            cands[k] = 0
    scored = []
    for k, inter in cands.items():
        vt = t_sets[k]
        name_hit = nm in t_names[k] or nm2 in t_names[k]
        ob_hit = nm == t_ob[k]
        cov_o = inter / len(vp) if vp else 0.0
        cov_t = inter / len(vt) if vt else 0.0
        jac = inter / len(vp | vt) if (vp | vt) else 0.0
        dist = km(o["coords"], by_key[k]["coords"])
        near = dist is not None and dist < 5
        score = cov_o + 0.5 * jac + 0.3 * name_hit + 0.1 * ob_hit + 0.1 * near
        scored.append(dict(tipnr=k, shared=inter, cov_ours=round(cov_o, 3), cov_tipnr=round(cov_t, 3),
                           jaccard=round(jac, 3), name=name_hit, openbible_name=ob_hit, km=dist,
                           score=round(score, 3)))
    scored.sort(key=lambda s: -s["score"])
    return scored


first = {o["id"]: candidates(o) for o in ours}
best0 = {pid: (sc[0]["tipnr"] if sc else None) for pid, sc in first.items()}
matches = []
for o in ours:
    scored = first[o["id"]]
    best = scored[0] if scored else None
    vp = o["osis"]
    # "Another name for the same place": our where_ref points to a place that is matched
    # to the same TIPNR place.
    alias = bool(best and o.get("where_tpl") == "same" and o.get("where_ref")
                 and best0.get(o["where_ref"]) == best["tipnr"])
    conf, relation = "none", None
    if best:
        near = best["km"] is not None and best["km"] < 5
        if best["cov_ours"] >= 0.6 and (best["name"] or alias or (near and best["shared"] >= 2)):
            conf = "high"
        elif not vp and best["name"] and near:
            conf = "high"
        elif best["name"] and (best["shared"] >= 1 or near):
            conf = "medium"
        elif best["cov_ours"] >= 0.6 and (best["shared"] >= 3 or (near and best["km"] < 1)):
            conf = "medium"
        elif best["shared"] >= 1 or best["name"]:
            conf = "low"
        relation = ("alias" if alias and not best["name"] else
                    "same_name" if best["name"] else "verses_only")
    matches.append({
        "place_id": o["id"], "name": o["name"], "kind": o["kind"], "verses": len(vp),
        "dup": bool(o.get("dup")), "confidence": conf, "relation": relation,
        "tipnr": best["tipnr"] if best and conf != "none" else None,
        "tipnr_ustrong": by_key[best["tipnr"]]["ustrong"] if best and conf != "none" else None,
        "best": best, "alternatives": scored[1:4],
        # Other TIPNR places our place covers (TIPNR splits them: Gilboa / Gilboa_Mount).
        "also_tipnr": [c["tipnr"] for c in scored[1:] if conf in ("high", "medium") and c["shared"] >= 1
                       and (c["name"] or (c["cov_tipnr"] >= 0.8 and c["shared"] >= 2))],
    })
t_to_ours: dict[str, list] = defaultdict(list)
for m in matches:
    if m["tipnr"] and m["confidence"] in ("high", "medium"):
        t_to_ours[m["tipnr"]].append(m["place_id"])
        for k in m["also_tipnr"]:
            t_to_ours[k].append(m["place_id"])
stats["match"] = {
    "ours_total": len(ours), "ours_with_verses": sum(1 for o in ours if o["osis"]),
    "by_confidence": Counter(m["confidence"] for m in matches),
    "by_confidence_with_verses": Counter(m["confidence"] for m in matches if m["verses"]),
    "tipnr_places": len(places_t),
    "tipnr_matched_hm": len(t_to_ours),
    "tipnr_to_many_ours": {k: v for k, v in t_to_ours.items() if len(v) > 1},
}
(HERE / "tipnr-places-match.json").write_text(json.dumps({
    "_source": "STEPBible TIPNR (CC BY 4.0), commit b99716b, matched to apps/web/public/data/places.geojson",
    "_method": "candidates = TIPNR places with shared verses or a matching name; "
               "score = share of our verses + 0.5*jaccard + 0.3*name + 0.1*name_OpenBible "
               "+ 0.1*(<5 km). "
               "high: >=60% of our verses in the TIPNR place and (name, or our where_ref=same "
               "leads to the same TIPNR place, or <5 km and >=2 shared verses); "
               "or we have 0 verses, but name and <5 km. "
               "medium: name + >=1 shared verse (or <5 km), or >=60% and >=3 verses without name. "
               "low: other candidates (usually neighbours in a single list verse, "
               "or a different identification).",
    "matches": matches,
}, ensure_ascii=False, indent=1))

# ---------- explicit place<->person links from TIPNR fields ----------
explicit: dict[tuple, str] = {}
for t in places_t:
    for fld, role in (("founders", "founder"), ("inhabitants", "inhabitant")):
        for l in t.get(fld, []):
            k = resolve(l["ref"], f"{t['key']}.{fld}")
            if k in person_keys:
                explicit[(k, t["key"])] = role
stats["explicit_links"] = Counter(explicit.values())

# ---------- co-mention: person x our place ----------
our_sets = {o["id"]: set(o["osis"]) for o in ours}
verse_to_ours: dict[str, set] = defaultdict(set)
for pid, s in our_sets.items():
    for x in s:
        verse_to_ours[x].add(pid)

MIN_SCORE, TOP_N, WINDOW, W_NEAR = 2.0, 15, 3, 0.25
POETRY = {"Ps", "Prov", "Eccl", "Song", "Lam"}


def min_score(n_place_verses: int) -> float:
    return MIN_SCORE if n_place_verses >= 10 else 1.5 if n_place_verses >= 5 else 1.0


def link_rule(score, direct, direct_w, n_life, ex, n_place):
    """The "lived/acted" rule (described in REPORT.md)."""
    if ex:
        return "explicit"
    if direct >= 1 and direct_w >= 0.5 and score >= min_score(n_place):
        return "core" if score >= 4 and direct >= 2 else "supporting"
    if n_life <= 3 and direct >= 1 and direct_w >= 1 and direct >= n_life / 2:
        return "local"  # little-known person, mentioned almost only together with this place
    return None


def neighbours(osis: str):
    b, c, v = osis.split(".")
    v = int(v)
    return [f"{b}.{c}.{v + k}" for k in range(-WINDOW, WINDOW + 1) if k and v + k > 0]


place_people: dict[str, list] = defaultdict(list)
person_places: dict[str, list] = defaultdict(list)
kept_pairs = Counter()
raw_pairs = 0
for p in people:
    refs, note = life[p["key"]]
    rs = set(refs)
    co: dict[str, list] = defaultdict(list)
    for x in refs:
        for pid in verse_to_ours.get(x, ()):
            co[pid].append(x)
    # Neighbourhood: the place is named in verse v, the person in v±3 of the same chapter
    # (same episode), but not in v.
    near: dict[str, set] = defaultdict(set)
    for x in refs:
        for y in neighbours(x):
            if y in rs:
                continue
            for pid in verse_to_ours.get(y, ()):
                near[pid].add(y)
    ex_ours = {}
    for (pk, tk), role in explicit.items():
        if pk == p["key"]:
            for pid in t_to_ours.get(tk, []):
                ex_ours[pid] = role
    for pid in set(co) | set(ex_ours):
        vs = co.get(pid, [])
        raw_pairs += 1
        direct = round(sum(w(x) for x in vs), 2)
        nb = near.get(pid, set())
        # Neighbourhood cannot add more than the direct mentions do (retrospective mentions
        # like "the sins of Jeroboam").
        score = round(direct + min(direct, W_NEAR * sum(w(y) for y in nb)), 2)
        tier = link_rule(score, len(vs), direct, len(refs), pid in ex_ours, len(our_sets[pid]))
        entry = {"score": score, "direct": direct, "shared": len(vs), "nearby": len(nb)}
        if not tier:
            continue
        kept_pairs[tier] += 1
        key_verses = sorted(vs, key=lambda x: (x.split(".")[0] in POETRY, len(ent_in_verse[x]), sort_key(x)))[:2]
        place_people[pid].append({
            "person": p["key"], "name": p["name"], "aka": p["total_names"], "gender": p["type"].lower(),
            "brief": p["desc"].get("brief", ""), "tier": tier, **entry,
            "lift": round(len(vs) / len(refs), 3) if refs else None,
            "explicit": ex_ours.get(pid), "key_verses": sorted(key_verses, key=sort_key),
        })
        person_places[p["key"]].append({"place_id": pid, "name": our_by_id[pid]["name"], "tier": tier,
                                        **entry, "explicit": ex_ours.get(pid)})
out_pp = {}
for pid, lst in place_people.items():
    lst.sort(key=lambda e: (-e["score"], -(e["lift"] or 0)))
    out_pp[pid] = {"name": our_by_id[pid]["name"], "people_total": len(lst), "top": lst[:TOP_N]}
stats["place_people"] = {"list_chapters": len(LIST_CHAPTERS), "pairs_cooccurring": raw_pairs, "pairs_kept": kept_pairs,
                         "places_with_people": len(out_pp)}
(HERE / "place-people.json").write_text(json.dumps({
    "_source": "STEPBible TIPNR (CC BY 4.0) x places.geojson osis",
    "_rule": f"verse weight w=1 (<=9 names of people and places in the verse), 0.5 (10-14), "
             f"0.2 (>=15); x0.3 if the chapter is a list "
             f"(>= {LIST_DENSITY} distinct names per verse of the chapter: "
             f"{len(LIST_CHAPTERS)} chapters); "
             f"direct = sum of w over verses that name both the person and the place "
             f"(only the person's 'life verses'); "
             f"score = direct + min(direct, {W_NEAR}*sum of w over the place's verses "
             f"where the person is named in a neighbouring verse ±{WINDOW}); "
             f"keep: an explicit TIPNR link (founder/inhabitant), or >=1 shared verse "
             f"with weight>=0.5 and score>=threshold "
             f"(2.0 for places with >=10 verses, 1.5 for 5-9, 1.0 for <=4) "
             f"(core: score>=4 and >=2 shared verses), or local: the person has <=3 verses, "
             f"half of them with the place and not in a list; "
             f"top {TOP_N} by score.",
    "places": out_pp}, ensure_ascii=False, indent=1))

# ---------- people ----------
def rel(lst, ctx):
    out = []
    for l in lst:
        k = resolve(l["ref"], ctx)
        out.append({"id": k or l["ref"], "resolved": bool(k), "flags": l["flags"]})
    return out


tipnr_places_of: dict[str, Counter] = defaultdict(Counter)
for p in people:
    refs, _ = life[p["key"]]
    for x in refs:
        for tk in verse_to_t.get(x, ()):
            tipnr_places_of[p["key"]][tk] += w(x)
people_out = []
for p in people:
    refs, note = life[p["key"]]
    tp = tipnr_places_of[p["key"]].most_common(12)
    people_out.append({
        "id": p["key"], "ustrong": p["ustrong"], "name": p["name"],
        "names": p["total_names"], "gender": p["type"].lower(), "anonymous": anonymous(p["key"]),
        "description": p["description"], "tribe": p["tribe"],
        "brief": p["desc"].get("brief", ""), "short": p["desc"].get("short", ""),
        "father": rel(p["father"], p["key"]), "mother": rel(p["mother"], p["key"]),
        "partners": rel(p["partners"], p["key"]), "siblings": rel(p["siblings"], p["key"]),
        "offspring": rel(p["offspring"], p["key"]),
        "refs": sorted(p["refs"], key=sort_key), "life_refs_note": note or None,
        "life_refs_count": len(refs),
        "places_tipnr": [{"tipnr": k, "score": round(s, 2), "ours": t_to_ours.get(k, [])} for k, s in tp],
        "places_ours": sorted(person_places.get(p["key"], []), key=lambda e: -e["score"]),
        "explicit_places": [{"tipnr": tk, "role": role, "ours": t_to_ours.get(tk, [])}
                            for (pk, tk), role in explicit.items() if pk == p["key"]],
    })
(HERE / "tipnr-people.json").write_text(json.dumps({
    "_source": "STEPBible TIPNR (CC BY 4.0), commit b99716b; descriptions adapted by STEPBible from Claude 3 Opus output",
    "people": people_out}, ensure_ascii=False))
stats["people"] = {"male": sum(p["type"] == "Male" for p in people),
                   "female": sum(p["type"] == "Female" for p in people),
                   "anonymous": sum(anonymous(p["key"]) for p in people),
                   "groups_excluded": len(groups),
                   "with_places_ours": len(person_places),
                   "eponym_restricted": sum(1 for v in life.values() if v[1].startswith("eponym")),
                   "lifebook_restricted": sum(1 for v in life.values() if v[1].startswith("life"))}

# ---------- genealogy ----------
edges: dict[tuple, dict] = {}
group_edges = 0


def add(parent, child, src, flags):
    global group_edges
    if parent not in person_keys or child not in person_keys:
        group_edges += 1
        return
    e = edges.setdefault((parent, child), {"from": parent, "to": child, "role": None,
                                           "source": set(), "flags": set()})
    e["source"].add(src)
    e["flags"].update(flags)
    e["role"] = "father" if by_key[parent]["type"] == "Male" else "mother"


partners = set()
for p in people:
    for fld in ("father", "mother"):
        for l in p[fld]:
            k = resolve(l["ref"], p["key"])
            if k:
                add(k, p["key"], "child_record", l["flags"])
    for l in p["offspring"]:
        k = resolve(l["ref"], p["key"])
        if k:
            add(p["key"], k, "parent_record", l["flags"])
    for l in p["partners"]:
        k = resolve(l["ref"], p["key"])
        if k in person_keys:
            partners.add(tuple(sorted((p["key"], k))))
nodes = [{"id": p["key"], "name": p["name"], "gender": p["type"].lower(), "anonymous": anonymous(p["key"]),
          "era": (ERA.search(p["description"]).group(1).strip() if ERA.search(p["description"]) else None)}
         for p in people]
E = [{**e, "source": sorted(e["source"]), "flags": sorted(e["flags"])} for e in edges.values()]
one_sided = [e for e in E if len(e["source"]) == 1]
(HERE / "genealogy.json").write_text(json.dumps({
    "_source": "STEPBible TIPNR (CC BY 4.0), commit b99716b",
    "_flags": {"a": "ancestor, not a direct parent",
               "?": "decision made under ambiguity (TinyURL.com/TIPNR-Decisions)",
               "d": "group of descendants (not part of the people graph)", "f": "founder"},
    "nodes": nodes, "edges": E,
    "partners": [{"a": a, "b": b} for a, b in sorted(partners)]}, ensure_ascii=False))
stats["genealogy"] = {"nodes": len(nodes), "edges": len(E), "partners": len(partners),
                      "edges_flag_a": sum("a" in e["flags"] for e in E),
                      "edges_flag_q": sum("?" in e["flags"] for e in E),
                      "edges_one_sided": len(one_sided),
                      "one_sided_by_source": Counter(e["source"][0] for e in one_sided),
                      "person_to_group_edges_skipped": group_edges}
stats["unresolved_links"] = sorted(set(unresolved))
(HERE / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1, default=list))
print(json.dumps({k: v for k, v in stats.items() if k != "unresolved_links"}, ensure_ascii=False, indent=1,
                 default=list)[:5000])
