# Adding a language

What a third language needs, in the order to do it. The code reads every language through
one list and a few helpers (cleanup of 2026-10-04); what is left is the words themselves and
the build steps that still write Russian fields by name.

## 1. Switch it on

- `packages/model/src/time.ts`: add the code to `LOCALES` and its own name to
  `LOCALE_NAMES`; if the code is not yet in `Locale`, add it there and give `formatYear`
  and `formatCentury` its forms.
- `apps/web/vercel.json` redirects that name languages (`/:lang(en|ru)/…`): add it.

## 2. The interface

- `apps/web/src/i18n/<code>.json`: every key of `en.json`. The i18n test fails on a missing
  key and on a counted string without each plural form the language uses
  (`Intl.PluralRules`).
- `scripts/page-words.ts`: a block for the static pages and one for the front page. The
  typecheck fails on a missing or extra word.
- `packages/model/src/scripture.ts`: the language's book names (`bookName`; Ukrainian
  reads the Synodal forms until it has its own) and its deuterocanonical mark.

## 3. The content

Every text in the content is `{ en, ru, <code>? }` (`inLanguages` in
`packages/model/src/content.ts`): the schema already takes `uk` and `de`; add the code
there for another. A translated text must have as many paragraphs as the English.

- Articles, questions, tours, events, battles, periods, ancient authors: add the language's
  key beside `en` and `ru`.
- Source lines: a `content/sources-<code>.yaml` like `sources-ru.yaml`, and its reading in
  `scripts/build-content.ts` (today `sources_ru` only).

## 4. Names on the map (still Russian by name in the build)

The map and the app read a feature's text as `<field>_<code>` (`inLocale` in
`packages/core/src/style.ts`, `placeName` and `namesOf` in the model), so a language
needs only these fields written by `scripts/build-content.ts`:

- `name_<code>` for places (from `content/place-names.yaml`, today a `ru` field per place),
  states (`content/polity-names.yaml`) and modern places (`content/modern-names.yaml`);
- `label_<code>` for candidate sites (`siteLabelRu` in `packages/model/src/sites.ts`, a
  Russian template today) and `v_<code>` for a vassal's second line;
- `dup_<code>`: namesakes sharing a point and a name in that language
  (`markRussianDuplicates` in `apps/web/src/data.ts`);
- the people's names (`content/people-ru.json`, a Russian slot in `people.json`).

## 5. Where Russian grammar is built in

Kept on purpose, extended per language only if wanted: the print quiz's case forms
(`scripts/russian-forms.ts`, `inCaseOf` in `apps/web/src/print.ts`), the search's Russian
stems (`apps/web/src/data.ts`) and the places-in-any-text index
(`scripts/build-text-places.ts`, `public/hg-places.js`), built for English and Russian.

## 6. Check

`pnpm gate:full`, `pnpm e2e` (its steps find buttons by their Russian names: run it in
Russian) and a look at a place card, a tour and a printed sheet in the new language.
