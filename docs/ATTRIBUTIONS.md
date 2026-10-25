# Attributions

The third-party data and software the product ships with, as of 2026-10-25. Every
source was checked against its licence text (2026-09-28, rechecked 2026-10-01; the Bible
editions and the photo licences again on 2026-10-25). The public credits are on the
sources page (docs/sources.html, in every language), with each licence linked.
Sources under share-alike or non-commercial licences are deliberately absent (ADR 0008).
Sources researched but not used (OpenHistoricalMap, GEBCO, the BSB) are
listed again only when they are imported. STEPBible TIPNR, Pleiades and Itiner-e were
imported on 2026-10-02.

```text
DATA SOURCES AND CREDITS

Bible places
  Bible place identifications and verse links: OpenBible.info Bible Geocoding
  Data (https://github.com/openbibleinfo/Bible-Geocoding-Data), licensed under
  CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified.

Bible people and family links
  STEP Bible TIPNR — Translators Individualised Proper Names with all References
  (https://github.com/STEPBible/STEPBible-Data, commit b99716b), data created by
  STEP Bible (https://www.STEPBible.org) based on work at Tyndale House Cambridge,
  licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
  Modified: matched to OpenBible places, filtered and restructured
  (pipeline/people); uncertain family links left out. The raw file is not
  redistributed. Synodal Russian forms of the names read from the 1876 text
  (public domain).

Roman roads
  de Soto, P., Pažout, A., Brughmans, T., Vahlstrup, P., et al. (2025). A
  High-Resolution Dataset of Roads of the Roman Empire: Itiner-e static version
  2024 (v1.3). Zenodo. https://doi.org/10.5281/zenodo.17122148. Licensed under
  CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified: clipped to
  12W-75E, 8N-50N, geometry simplified, segments merged by name (pipeline/roads).

Periods in which places are attested
  Pleiades: A Gazetteer of Past Places. Ed. by Tom Elliott, Sean Gillies,
  Jeffrey Becker et al. Institute for the Study of the Ancient World, New York
  University, 2006–. https://pleiades.stoa.org. Data downloaded 2 October 2026.
  Licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/us/).
  Modified: matched to our places, periods reduced to a span of years.
  Pleiades' own form of citation: Roger Bagnall et al. (eds.), Pleiades: A Gazetteer
  of Past Places (https://pleiades.stoa.org), with the date of access.

Ancient sites outside the Bible (the "Ancient world" layer)
  Points and identifiers from Pleiades (as above, CC BY 3.0), selected and checked
  by hand (content/ancient-sites.json); founding and end years and Russian names
  checked against Wikidata (https://www.wikidata.org, CC0) and encyclopaedias.

Verse counts for reference checking
  Chapter and verse counts derived from the World English Bible
  (https://ebible.org/engwebp), public domain. "World English Bible" is a
  trademark of eBible.org. Not shipped as text; used to check references.

Polity borders
  Cliopatria, Seshat Global History Databank — Chalstrey, E., Bennett, J.
  et al., v0.2.0, doi:10.5281/zenodo.20274630, licensed under CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/). Modified.

  Coordinates for places whose OpenBible point came from OpenStreetMap or Google:
  Wikidata (https://www.wikidata.org), CC0. The places' Wikidata items are OpenBible's
  links, checked against Wikidata: wrong ones left out, merged items followed
  (scripts/wikidata-links.ts).

Terrain
  Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus
  Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European
  Union and ESA; all rights reserved.
  The organisations in charge of the Copernicus programme by law or by
  delegation do not incur any liability for any use of the Copernicus
  WorldDEM-30.

  Terrain tiles prepared with Mapterhorn (https://mapterhorn.com); source
  list: https://mapterhorn.com/attribution.
  ASTER GDEM courtesy of METI and NASA (Israel 10 m DEM processed by 4cast LTD).
  Cyprus DTM 2019 © Department of Lands and Surveys, Republic of Cyprus,
  licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
  Zoomed in, other countries' relief comes from their national elevation models
  (IGN France, CNIG España, INGV and others, 151 sources in all) under their open
  licences; CC BY 4.0 allows the credit to point to Mapterhorn's list above, which the
  sources page does.

Base cartography
  Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.

Scripture
  The verse texts and quotations in each language come from a public-domain edition,
  from eBible.org's USFM editions or CrossWire's SWORD modules (the .conf of each says
  DistributionLicense=Public Domain); scripts/bible-text.ts lists them (SOURCES) with
  the repairs made to their digital text (REPAIRS), and scripts/build-verses.ts
  records the sha256 of each file in data/verses/sources.json.
    en  King James Version, 1769 standard text (eBible.org eng-kjv2006); public
        domain outside the United Kingdom, Crown copyright (letters patent) in it
    ru  Synodal Translation, 1876 (eBible.org russyn)
    uk  Bible translated by P. Kulish and I. Puluj, 1905, with I. Nechui-Levytsky
        (eBible.org ukr1871)
    es  Reina-Valera 1909 (eBible.org spaRV1909)
    pt  Bíblia Portuguesa Mundial, a draft translation still under revision
        (eBible.org porbrbsl)
    de  Lutherbibel 1912 (eBible.org deu1912)
    fr  Louis Segond 1910 (eBible.org fraLSG)
    it  Riveduta 1927 (eBible.org ita1927)
    nl  Statenvertaling, 1917 edition (eBible.org nld)
    cs  Bible kralická, 1613 (eBible.org ces1613)
    sr  Daničić–Karadžić translation, Cyrillic (eBible.org srp1868)
    pl  Biblia Gdańska, 1881 edition (CrossWire PolGdanska)
    sv  Bibeln 1917 (CrossWire Swe1917, from Projekt Runeberg)
    da  Det Gamle Testamente 1871 and Det Nye Testamente 1907 (CrossWire
        DaOT1871NT1907)
    nb  Bibelen 1930, Det Norske Bibelselskap (CrossWire Norsk)
    tl  Ang Biblia 1905, Philippine Bible Society (CrossWire TagAngBiblia)
    zh  Chinese Union Version, simplified (eBible.org cmn-cu89s): verse texts only,
        for a language not yet on the site
  All public domain. Names are read from the Synodal text for Russian and checked
  against the KJV for English.

Photos
  Photos of places in the place card come from Wikimedia Commons, each public domain,
  CC0 or CC BY (no share-alike); its author, its licence (linked to the licence text,
  `license_url` in content/photos.yaml) and its file page are given with it, in the
  card and on the place page. Images are resized and cropped to the frame, as the
  sources page says, and served from the site, not hotlinked.

Articles, answers and events
  Written for the project; the sources each one rests on are listed with it
  (content/articles, content/questions, content/events.yaml). Quotations come only
  from the public-domain edition of each language listed under Scripture.

Software
  MapLibre GL JS — Copyright (c) 2023, MapLibre contributors, BSD-3-Clause;
  includes code from mapbox-gl-js v1.13 and earlier (Copyright (c) 2020,
  Mapbox, BSD-3-Clause), glfx.js (MIT) and d3-color. Full license text:
  vendor/maplibre-gl-<version>/LICENSE.txt in the build.
  React, react-dom, scheduler (MIT) and the Golos Text and Literata fonts (OFL 1.1):
  licence texts in apps/web/public/licenses/third-party.txt, written by
  scripts/third-party-licenses.ts (pnpm licenses) and linked from the sources page.
  The MapLibre files are shipped as published (only the source-map pointer at the
  end of each is dropped, with the maps), with their LICENSE.txt, under
  vendor/maplibre-gl-<version>/ in the build.
  Lucide icons — Copyright (c) 2026 Lucide Icons and Contributors, ISC; nine of
  the fifteen icons derive from Feather, Copyright (c) 2013-present Cole Bemis, MIT.
  Copied as SVG (apps/web/src/components/icons.tsx); both licences ship in
  licenses/lucide-icons.txt.

No endorsement by any of the above organisations is implied.
```
