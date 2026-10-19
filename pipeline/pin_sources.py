"""Move the pins of pipeline/sources.json to the latest commit of each upstream file.

    python3 pipeline/pin_sources.py                 # show what has moved upstream, change nothing
    python3 pipeline/pin_sources.py --write [name…] # rewrite the pins (all, or the names given)

For each source: the latest commit of its repository's default branch that touched the file
(GitHub API, no token), the file at that commit downloaded and hashed (the extracted member for
an archive). With --write the pin, the hash and the date are rewritten and the cached file is
removed, so the next `pnpm data` fetches the pinned file afresh and checks it. Review the data
checks after a move: upstream changes names, points and borders, not only bytes.
"""

from __future__ import annotations

import hashlib
import io
import json
import pathlib
import sys
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PINS_FILE = ROOT / "pipeline" / "sources.json"
CACHE = ROOT / "pipeline" / ".cache"
UA = {"User-Agent": "history-globe-pipeline/1.0 (github.com/ArVaViT/history-globe)"}


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
        return r.read()


def latest(repo: str, path: str) -> tuple[str, str]:
    """The newest commit touching the path on the default branch: (sha, date)."""
    commits = json.loads(get(f"https://api.github.com/repos/{repo}/commits?path={path}&per_page=1"))
    if not commits:
        raise SystemExit(f"{repo}: no commit touches {path}")
    return commits[0]["sha"], commits[0]["commit"]["committer"]["date"][:10]


def fetch_hash(repo: str, path: str, commit: str, member: str | None) -> str:
    data = get(f"https://raw.githubusercontent.com/{repo}/{commit}/{path}")
    if member:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = z.namelist()
            if member not in names:
                raise SystemExit(f"{repo}@{commit[:12]}: {path} holds {names}, not {member}; set zip_member in sources.json")
            data = z.read(member)
    return hashlib.sha256(data).hexdigest()


def main(argv: list[str]) -> None:
    write = "--write" in argv
    names = [a for a in argv if not a.startswith("--")]
    doc = json.loads(PINS_FILE.read_text(encoding="utf-8"))
    pins = {k: v for k, v in doc.items() if k != "_"}
    for name in names:
        if name not in pins:
            raise SystemExit(f"{name}: not in pipeline/sources.json ({', '.join(pins)})")
    moved = 0
    failed = 0
    for name, pin in pins.items():
        if names and name not in names:
            continue
        sha, date = latest(pin["repo"], pin["path"])
        if sha == pin["commit"]:
            print(f"{name}: at the latest commit ({sha[:12]}, {pin['committed']})")
            continue
        try:
            digest = fetch_hash(pin["repo"], pin["path"], sha, pin.get("zip_member"))
        except SystemExit as e:
            print(f"{name}: upstream moved to {sha[:12]} ({date}), but {e}")
            failed += 1
            continue
        same = digest == pin["sha256"]
        print(
            f"{name}: upstream moved {pin['commit'][:12]} ({pin['committed']}) → {sha[:12]} ({date}), "
            f"file {'unchanged' if same else 'CHANGED'}"
        )
        moved += 1
        if write:
            pin.update({"commit": sha, "committed": date, "sha256": digest})
    if write and moved:
        PINS_FILE.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        # The build's cache holds the old files: out they go, so the next build fetches the pins.
        from build_data import SOURCES  # noqa: PLC0415  (imports the file just rewritten)

        for name in pins:
            if names and name not in names:
                continue
            (CACHE / SOURCES[name]["file"]).unlink(missing_ok=True)
        print(f"pipeline/sources.json rewritten ({moved} moved); run `pnpm data` and the data checks")
    elif moved and not write:
        print("nothing written; add --write to move the pins")
    if failed:
        raise SystemExit(f"{failed} source(s) could not be read at the latest commit; the pins stand")


if __name__ == "__main__":
    main(sys.argv[1:])
