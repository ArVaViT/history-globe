# Ancient sites by script (ADR 0018)

How `content/ancient-sites-wave1.json` was made, to make the next wave the same way. `S` is a
work directory outside the repo (the downloads stay there); `R` is this repo.

1. Download Pleiades' dumps (CC BY 3.0) into `S/pleiades-dl/`: `pleiades-places-latest.csv.gz`
   and `pleiades-names-latest.csv.gz` from https://atlantides.org/downloads/pleiades/dumps/.
2. Ask Wikidata for every item with a Pleiades id and its sitelinks (`S/wd/pleiades-sitelinks.csv`:
   `SELECT ?item ?pid ?links WHERE { ?item wdt:P1584 ?pid . ?item wikibase:sitelinks ?links . }`).
3. `python3 -I candidates.py S R`: precise points inside the focus ring, settlements,
   sanctuaries and ports, none within 3 km of a place we have.
4. `python3 -I fetch.py S`: classes, labels in our 21 languages and dates of those items.
5. `python3 -I select.py S`: ancient sites only (no modern town, museum or castle).
6. `python3 -I periods.py S`: years from the periods Pleiades attests, modern ones left out.
7. `python3 -I assemble.py S R`: names no other place has; writes the content file.

The class labels for step 5 (`S/wave/classes.json`) come from one more query on the classes
the candidates have.
