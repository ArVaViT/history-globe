"""Itiner-e's roads (Zenodo 10.5281/zenodo.17122148, v1.3, CC BY 4.0) into the pipeline cache.

78 MB, fetched once and checked against the release's MD5; build_roads.py then clips them
to the map's region and simplifies them into apps/web/public/data/roads-{major,minor}.geojson.
"""

import hashlib
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
DEST = ROOT / "pipeline" / ".cache" / "itinere_roads.geojson"
URL = "https://zenodo.org/api/records/17122148/files/itinere_roads.geojson/content"
MD5 = "1316a6aa975b5e3db2e3c9e90fb3714b"


def main() -> None:
    if not DEST.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": "history-globe-pipeline/1.0"})
        with urllib.request.urlopen(req, timeout=600) as r:
            DEST.write_bytes(r.read())
    got = hashlib.md5(DEST.read_bytes()).hexdigest()
    if got != MD5:
        raise SystemExit(f"itinere_roads.geojson: md5 {got}, expected {MD5}")


if __name__ == "__main__":
    main()
