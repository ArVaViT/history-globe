"""Requests the pipeline makes: one User-Agent, and Wikidata asked politely.

Wikimedia asks every client to identify itself; the project's repository is the contact.
HG_CONTACT adds an address of the one running the script, if they want to give one.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "history-globe-pipeline (+https://github.com/ArVaViT/history-globe" + (
    f"; {contact})" if (contact := os.environ.get("HG_CONTACT")) else ")"
)
SPARQL = "https://query.wikidata.org/sparql"
ATTEMPTS = 6


def get(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None, timeout: float = 600) -> bytes:
    """The body at the URL. A busy server (429, 5xx) or a dropped connection is tried again,
    after the wait the server names or a growing pause; anything else fails at once."""
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
    for attempt in range(1, ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if (e.code != 429 and e.code < 500) or attempt == ATTEMPTS:
                raise
            wait = float(e.headers.get("Retry-After") or 10 * attempt)
        except (urllib.error.URLError, TimeoutError):
            if attempt == ATTEMPTS:
                raise
            wait = 10.0 * attempt
        print(f"{urllib.parse.urlsplit(url).netloc}: busy, again in {wait:.0f} s")
        time.sleep(wait)
    raise AssertionError("unreachable")


def wikidata_get(url: str) -> dict:
    """A Wikidata API call, with a pause after it: the API's etiquette for a bot."""
    body = json.loads(get(url))
    time.sleep(1.0)
    return body


def sparql(query: str) -> list[dict]:
    """The rows of a query to the Wikidata Query Service, with a pause after it."""
    body = get(
        SPARQL,
        data=urllib.parse.urlencode({"query": query}).encode(),
        headers={"Accept": "application/sparql-results+json"},
        timeout=120,
    )
    time.sleep(2.0)
    return json.loads(body)["results"]["bindings"]


def entity(binding: dict, key: str) -> str:
    """The id at the end of an entity URI in a SPARQL row: ".../entity/Q1218" → "Q1218"."""
    return binding[key]["value"].rsplit("/", 1)[1]
