"""Itiner-e's roads (Zenodo 10.5281/zenodo.17122148, v1.3, CC BY 4.0) into the pipeline cache.

78 MB, fetched once and checked against the MD5 Zenodo publishes for the file; build_roads.py
then clips them to the map's region and simplifies them into
apps/web/public/data/roads-{major,minor}.geojson.
"""

import hashlib
import pathlib

from pipeline.net import get

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

DEST = ROOT / "pipeline" / ".cache" / "itinere_roads.geojson"
URL = "https://zenodo.org/api/records/17122148/files/itinere_roads.geojson/content"
MD5 = "1316a6aa975b5e3db2e3c9e90fb3714b"


def main() -> None:
    if not DEST.exists():
        DEST.write_bytes(get(URL))
    got = hashlib.md5(DEST.read_bytes()).hexdigest()
    if got != MD5:
        raise SystemExit(f"itinere_roads.geojson: md5 {got}, expected {MD5}")


if __name__ == "__main__":
    main()
