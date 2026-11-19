# Ancient sites by script (ADR 0018)

How `content/ancient-sites-wave<N>.json` are made, so the next wave is made the same way. `W`
is a work directory outside the repository, which keeps the downloads and each step's files
under `W/wave/`. Run the steps from the repository root after `pnpm data`.

1. Download Pleiades' places dump (CC BY 3.0), `pleiades-places-latest.csv.gz` from
   https://atlantides.org/downloads/pleiades/dumps/, and save it as `W/pleiades-dl/places.csv.gz`.
2. Ask Wikidata for every item with a Pleiades id and its sitelinks, and save the result as
   `W/wd/pleiades-sitelinks.csv`:
   `SELECT ?item ?pid ?links WHERE { ?item wdt:P1584 ?pid . ?item wikibase:sitelinks ?links . }`
3. `python3 -I pipeline/ancient/candidates.py W`: precise points inside the focus ellipse,
   settlements, sanctuaries and ports, none within 3 km of a place on the map.
4. `python3 -I pipeline/ancient/fetch.py W`: the candidates' classes, labels in the site's
   languages and dates, and the English labels of those classes.
5. `python3 -I pipeline/ancient/select.py W`: ancient sites only (no modern town, museum or castle).
6. `python3 -I pipeline/ancient/periods.py W`: years from the periods Pleiades attests,
   modern ones left out.
7. `WAVE=<N> python3 -I pipeline/ancient/assemble.py W`: names no other place has; writes the
   content file.

Wave 1 took the items with at least 8 Wikipedia articles; wave 2 (`FAME=5`, `WAVE=2`) those
with 5 to 7 and those wave 1's classes missed; wave 3 (`FAME=3`, `WAVE=3`) those with 3 and 4.
Steps 3 to 7 take `FAME` (the fewest articles); a later wave skips every site already in one.

After a wave:

8. `python3 -I pipeline/ancient/fame.py W`: the Wikipedia articles of every place's own Wikidata
   item, where that item is an ancient site (`content/fame.json`); the data build ranks by it.
9. `python3 -I pipeline/ancient/coords.py`: every site's point against its Wikidata item's;
   those more than 5 km apart are read one by one. A site refused there goes into `REFUSED` in
   `candidates.py`, so no later wave brings it back.

`python3 -I pipeline/ancient/audit.py W` lists the sites chosen by hand
(`content/ancient-sites.json`) whose years stray far from Wikidata's or Pleiades'.

Requests identify the project (`pipeline/net.py`); set `HG_CONTACT` to add your address.
