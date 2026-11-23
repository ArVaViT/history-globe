# Licensing

History Globe. Copyright (c) 2026 Vadym Arnaut.

This repository holds code, texts and data under different licences. This file says which
licence covers which part, states the additional terms that apply to the code under section 7
of the GNU Affero General Public License, says how contributions are licensed, and names the
parts that belong to others. [`LICENSE`](LICENSE) holds the text of the GNU Affero General
Public License, version 3, the licence of the code; the texts of the other licences are in
[`LICENSES/`](LICENSES/). [`REUSE.toml`](REUSE.toml) gives the licence of every file in a form
that tools read; where the two differ, this file governs.

## At a glance

| Part                                                      | Where                                                       | Licence                                     |
| --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| 1. The code and the project's documentation               | every path not named below                                  | AGPL-3.0-or-later, with the section 7 terms |
| 1. The places-in-any-text script                          | `apps/web/public/hg-places.js`, `hg-places-*.js`            | MIT                                         |
| 1. The code examples in the documentation                 | `content/docs/`                                             | CC0 1.0                                     |
| 2. The place articles and the answered questions          | `content/articles/`, `content/questions/` and what is built | CC BY-NC-ND 4.0                             |
| 3. The data                                               | most of `content/`, the built data and the open API         | CC BY 4.0                                   |
| 3. The Wikidata labels                                    | `content/drafts/`                                           | CC0 1.0                                     |
| 4. The crosswalk tables                                   | `docs/crosswalk/places.csv`, `docs/crosswalk/people.csv`    | CC BY-SA 4.0                                |
| 5. The reviews                                            | `content/reviews/`                                          | each under the licence its author gave      |
| 6. Third-party data, images and software                  | as `docs/ATTRIBUTIONS.md` lists                             | their own licences                          |
| 7. The name "History Globe", the logo, the preview images | the icons, `apps/web/public/og.jpg`, `og/`, `shots/`        | not licensed                                |

Part 8 says how a contribution is licensed. A path that no part names is code (part 1).

## Part 1. The code: AGPL-3.0-or-later

The code is everything in the repository that parts 2 to 7 do not name: `apps/`, `packages/`,
`scripts/`, `pipeline/`, `e2e/`, `db/`, `.github/`, the configuration files at the root, and the
documentation of the project (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`,
`SECURITY.md`, `CITATION.cff`, this file, `content/README.md`, `docs/` and the site's
documentation pages in `content/docs/`).

> This program is free software: you can redistribute it and/or modify it under the terms of
> the GNU Affero General Public License as published by the Free Software Foundation, either
> version 3 of the License, or (at your option) any later version, with the additional terms
> below.
>
> This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
> without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
> See the GNU Affero General Public License for more details.
>
> You should have received a copy of the GNU Affero General Public License along with this
> program, in the file `LICENSE`. If not, see <https://www.gnu.org/licenses/>.

### Additional terms under section 7

These are additional terms of the licence of the code, as section 7 of the GNU Affero General
Public License permits them (its paragraphs (b), (c) and (e)). This file is the notice, in the
sense of section 7, that says where they are found, and section 4 asks every copy of the code to
keep it intact, with `LICENSE`. The terms apply to a modified version; an unmodified copy keeps
the notices as it received them.

- **(b) Attribution.** A modified version must keep the attribution
  "History Globe by Vadym Arnaut", with a link to <https://historyglobe.app>, in the notice or
  "about" information it shows its users (in the original: the Author and Build pages of the
  Help). It may word it as "Based on History Globe by Vadym Arnaut". This line is required,
  and keeping it does not breach (c) or (e).
- **(c) Marking a modified version.** A modified version must be marked in reasonable ways as
  different from the original: it may not present itself as History Globe, or as made or
  endorsed by its author. Going under a name of its own, with the line of (b), is such a
  marking.
- **(e) No trademark rights.** The licence grants no right under trademark law to use the name
  "History Globe" or its logo (part 7); the line of (b) names the original, as attribution.

### Two exceptions

So that the parts meant to run inside other sites can be used there freely:

- The places-in-any-text script, `apps/web/public/hg-places.js`, and its released versions,
  `apps/web/public/hg-places-*.js`, are under the
  [MIT licence](https://opensource.org/license/mit).
- The code examples in `content/docs/` (the embedding snippets and the API examples) are
  dedicated to the public domain under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Part 2. The articles and the questions: CC BY-NC-ND 4.0

The place articles (`content/articles/`), the questions and their answers
(`content/questions/`), in every language they are written or translated in, and the files the
build makes of them (`apps/web/public/data/articles/`, the article text on the place pages, the
question pages, `api/v1/questions.json`) are licensed under the Creative Commons
Attribution-NonCommercial-NoDerivatives 4.0 International licence:
<https://creativecommons.org/licenses/by-nc-nd/4.0/>.

In short (the licence's own text governs): you may copy and share them unchanged, in any medium
or format, on another site or in a collection too, with credit and the licence named, and not
for commercial purposes. You may not share a changed or translated version of them. Short
quotations with credit, as the law allows them, and links need no licence.

Credit: "History Globe (Vadym Arnaut), CC BY-NC-ND 4.0", with a link to the page and to the
licence.

### The change of 2026-10-17

Until 2026-10-17 these texts were offered under CC BY 4.0. Copies made under that licence keep
it (a Creative Commons licence cannot be revoked); what is published from that date on is under
CC BY-NC-ND 4.0.

### Text and data mining

For these texts, the copyright holder reserves the right to reproduce and extract them for text
and data mining, within the meaning of Article 4(3) of Directive (EU) 2019/790, including for
the training, fine-tuning or evaluation of machine-learning models, as far as the licence above
does not already permit the use. The site states the reservation in its `robots.txt` (the
Disallow lines for training crawlers and the Content-Signal line, `ai-train=no`) and in the
`tdm-reservation: 1` header. Both are sent for the whole site, but the reservation covers this
part only. Every other part is under its own licence, which governs it and which the
reservation does not narrow; the open data of the API stays open to every crawler.

## Part 3. The data: CC BY 4.0

The following are licensed under the Creative Commons Attribution 4.0 International licence,
<https://creativecommons.org/licenses/by/4.0/>:

- the curated content in `content/` other than `articles/`, `questions/`, `docs/`, `reviews/`,
  `drafts/` and `README.md`: place names in every language, tours, events, battles, when towns
  stood, ancient-author notes, photo records and the rest;
- the data the build makes from it: `apps/web/public/data/` except `articles/`, `photos/` and
  `verses/`; the open API in `apps/web/public/api/` except `questions.json`; and the route maps
  of the tours, `apps/web/public/og/tour/*.jpg` (the routes drawn on Natural Earth, which is in
  the public domain);
- the data files kept beside the code: `pipeline/rivers/rivers.geojson` (derived from
  RiverATLAS, CC BY 4.0), `pipeline/rivers/targets.json`, `pipeline/ancient/names-cyrillic.json`
  and `pipeline/dataset_card.md`.

Credit: "History Globe (Vadym Arnaut), CC BY 4.0", with a link to the source where the medium
allows.

### The Wikidata labels

`content/drafts/` holds labels taken from Wikidata, which Wikidata publishes under CC0 1.0. They
stay under CC0 1.0: <https://creativecommons.org/publicdomain/zero/1.0/>.

### Not licensed here

`apps/web/public/data/photos/` holds Wikimedia Commons photographs, each under the licence its
record names (`content/photos.yaml`; the place card and the place page show it), and
`apps/web/public/data/verses/` holds the Bible text of public-domain editions
(`docs/ATTRIBUTIONS.md`, "Scripture"). See part 6.

## Part 4. The crosswalk tables: CC BY-SA 4.0

`docs/crosswalk/places.csv` and `docs/crosswalk/people.csv` match our places and people to other
open datasets ([`docs/crosswalk.md`](docs/crosswalk.md)). Both carry, in their `theographic_*`
columns, the record ids and lookup names of Theographic Bible Metadata by Robert Rouse, which is
under CC BY-SA 4.0, and `places.csv` also the records Theographic takes for the same place. So
that nobody has to separate the columns, each of the two files is licensed as a whole under the
Creative Commons Attribution-ShareAlike 4.0 International licence:
<https://creativecommons.org/licenses/by-sa/4.0/>.

Credit: "History Globe (Vadym Arnaut), with Theographic Bible Metadata (Robert Rouse), CC BY-SA
4.0", with a link to the source where the medium allows.

These two files are the only share-alike part of the repository. They are not part of the site,
the API or the dataset, and none of Theographic's coordinates or other data is imported into
anything the site publishes (ADR 0008). `docs/crosswalk/their-errors.md` is documentation (part
1).

## Part 5. The reviews

The reviews in `content/reviews/` belong to their authors. Each file names its author and the
licence the author gave it (the `licence` field).

## Part 6. Third-party data, images and software

Third-party data, images and software included or referenced here remain under their own
licences: OpenBible.info, STEPBible TIPNR, Cliopatria, Pleiades, Itiner-e, RiverATLAS, Natural
Earth, Copernicus WorldDEM-30 and the other elevation models, Theographic Bible Metadata,
Wikidata, the Wikimedia Commons photographs, the public-domain Bible editions, MapLibre, React,
Lucide, the fonts and others. See [`docs/ATTRIBUTIONS.md`](docs/ATTRIBUTIONS.md) and
`apps/web/public/licenses/`.

`CODE_OF_CONDUCT.md` is the [Contributor Covenant](https://www.contributor-covenant.org),
version 2.1, under CC BY 4.0, with the project's contact address added.

The grants in parts 1 to 4 and the reservation in part 2 cover this project's own contribution
only; they relicense and reserve none of these.

## Part 7. The name, the logo and the preview images: not licensed

The name "History Globe" and its logo (`apps/web/public/favicon.*`, `icon-*.png`,
`apple-touch-icon.png`) are not licensed under any of the above. All rights reserved.

The preview images (`apps/web/public/og.jpg`, `og/<language>.jpg`, `shots/`) are pictures of
the site. The project's own part of them, its interface with the name and the logo, is not
licensed either. What they show of the data and the texts keeps the licence of its part above,
and what they show from third parties keeps its own licence (part 6): the borders from
Cliopatria (CC BY 4.0), the relief from Copernicus WorldDEM-30 and the other elevation models,
Natural Earth, and the photographs in the cards, each under the licence printed on it:

- in `shots/*-place.jpg`, "Jerusalem Old City from the Mount of Olives" by Kok Leng Yeo,
  CC BY 2.0 (<https://creativecommons.org/licenses/by/2.0/>);
- in `shots/*-tour.jpg`, "Herodes Atticus Bath near Alexandria Troas" by Raicem, CC BY 4.0
  (<https://creativecommons.org/licenses/by/4.0/>).

## Part 8. Contributions

No copyright assignment and no contributor licence agreement are asked. You keep the copyright
in what you contribute, and by submitting it for inclusion (a pull request, a patch, or text or
data sent by an issue or by email) you license it as follows:

- **Code** is licensed under AGPL-3.0-or-later, with the additional terms of part 1, as the
  code is; a change to the places-in-any-text script under MIT, and a code example in the
  documentation under CC0 1.0, as those files are.
- **Articles, answers, data and every other text** are licensed under CC BY 4.0. Under that
  licence the maintainer may edit and translate them and publish them with the rest of their
  part, under its licence (for an article or an answer, CC BY-NC-ND 4.0), and may give
  partners further licences. What you submitted, as you submitted it, stays available under
  CC BY 4.0.
- **A review** stays its author's, under the licence its author gives it (part 5).

The `Signed-off-by` line of each commit certifies the
[Developer Certificate of Origin](https://developercertificate.org/): that you wrote the
contribution or have the right to submit it under these licences. See
[`CONTRIBUTING.md`](CONTRIBUTING.md).
