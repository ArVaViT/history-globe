# content/

Everything written or chosen by hand, as data (ADR 0007). `pnpm content` checks every file
against its schema (`packages/model/src/content.ts`) and the rules in
[`docs/data-checks.md`](../docs/data-checks.md), and builds the site's data, pages and API
from it. Each file says in its header (a comment, or `_source` / `_about` in JSON) where it
comes from and how it was checked.

The articles and the questions are under CC BY-NC-ND 4.0, the rest under CC BY 4.0
(`LICENSE`, ADR 0016); third-party data keeps its own licence (`docs/ATTRIBUTIONS.md`).

## Texts

| Path          | What                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| `articles/`   | the place articles, one file a place, in every language, with their sources    |
| `questions/`  | the answered questions (the `/q/` pages), with the view of the map and sources |
| `tours/`      | the tours, stop by stop, each stop with its passage or its ancient source      |
| `reviews/`    | the scholars' reviews of articles, questions and tours, under their names      |
| `docs/<lang>` | the documentation pages (`/docs/`), one folder a language, and `docs.css`      |

`content/docs/` is the documentation the site publishes; `docs/` at the root of the
repository is for those who work on it (decisions, checks, how the data is built).

## Time and history

| File                    | What                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| `events.yaml`           | dated events, each with its sources                                              |
| `battles.yaml`          | battles and sieges                                                               |
| `place-life.yaml`       | the years a place stood as a town, and lay in ruins                              |
| `chapter-years.yaml`    | the year the map shows for a chapter of the Bible                                |
| `polity-overrides.yaml` | corrections to Cliopatria's borders and years, each with a reason and sources    |
| `ancient-authors.yaml`  | what ancient writers outside the Bible say of a place, in our words, with a link |

## Places and names

| File                                   | What                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `place-names.yaml`                     | Russian names of the places, as the Synodal text spells them                        |
| `names-<lang>.yaml`                    | names in the other languages: places, states, modern names and people               |
| `modern-names.yaml`                    | Russian forms of the modern names of sites                                          |
| `polity-names.yaml`                    | Russian names of Cliopatria's states                                                |
| `place-points.json`                    | places whose point is chosen by hand, with the reason                               |
| `photos.yaml`                          | the photo of each place from Wikimedia Commons, with author and licence             |
| `wikidata.json`, `tipnr.json`          | each place's Wikidata item and STEPBible TIPNR name, as OpenBible links them        |
| `pleiades.json`                        | each place's Pleiades record and the years it is attested                           |
| `ancient-sites.json`, `…-wave<n>.json` | the places of the ancient world the Bible does not name (ADR 0013, ADR 0018)        |
| `fame.json`                            | how widely a town is known (the Wikipedia articles of its item), for its rank       |
| `drafts/`                              | Wikidata labels kept for translators; not read by the build (ADR 0013 names one)    |
| `sources-ru.yaml`, `sources-own.yaml`  | the source lines in Russian, and the site's own source lines in the other languages |

## People

| File                             | What                                                                      |
| -------------------------------- | ------------------------------------------------------------------------- |
| `people-ru.json`                 | Synodal forms of the names of the people in STEPBible TIPNR               |
| `people-epithets.json`           | namesakes told apart as the text tells them (John the Baptist)            |
| `people-not-in-text.json`        | family links TIPNR gives and the text does not make: dropped              |
| `people-links-in-text.json`      | family links the text makes and TIPNR leaves out: added, with their verse |
| `people-places-not-in-text.json` | ties of a person to a place that the verse does not bear out: dropped     |
