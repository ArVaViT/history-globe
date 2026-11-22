# Adding a language

What a new language needs, in the order to do it. Every language is equal (ADR 0015): the
code reads each one through the same lists, and the tests and the typecheck name most of
what is missing.

## 1. The code

- `packages/model/src/locales.ts`: the code in `Locale` and `ALL_LOCALES` (the languages the
  code can format), unless it is there already (`zh` is); then in `LOCALES` (the languages
  the site is published in, in the order of their own names) and its own name in
  `LOCALE_NAMES`.
- `packages/model/src/locales/<code>.ts`: book names and abbreviations, era names, the
  site-label templates, year and century formats, the deuterocanonical mark. It loads with the
  language (ADR 0021).
- `packages/model/src/content.ts`: the code in `inLanguages`, and in `NAME_LOCALES` when its
  place names come from a `names-<code>.yaml`.
- `apps/web/vercel.json`: the code in each `:lang(…)` pattern of the redirects.

## 2. The interface

- `apps/web/src/i18n/<code>.json`: every key of `en.json`. The i18n test fails on a missing key
  and on a counted string without each plural form the language uses (`Intl.PluralRules`).
- `scripts/page-words.ts`: the words of the static pages and the front page. The typecheck
  fails on a missing or extra word.
- The hand-written pages name every language: `apps/web/index.html`, `public/404.html`,
  `public/about.html`, and `LANGS` in `public/hg-places.js`. `apps/web/src/static-pages.test.ts`
  fails until each has it.
- `LANGS` in `pipeline/build_dataset.py` (the dataset's name columns): `pipeline/test_mirrored.py`
  fails until it has the language.
- `apps/web/public/og/<code>.jpg` (the link preview) and `apps/web/public/shots/<code>-*.jpg`
  (the screenshots on the front page): the app in the language, at the size of the files
  already there.

## 3. The content

- Every text in `content/` with a key per language (articles, questions, tours, events, battles,
  periods, ancient authors): the language's key beside `en`. A translation has as many
  paragraphs as the English; the build checks it.
- `content/names-<code>.yaml`: the names of places, states, modern places and people
  (`scripts/build-content.ts` writes them as `name_<code>`).
- `content/sources-<code>.yaml`: every source line in the language; the build stops
  without them.
- `content/docs/<code>/`: the documentation pages, one per page of `content/docs/en/`.

## 4. Grammar

Where a language declines names, the places-in-any-text index needs their forms
(`scripts/inflected-forms.ts`, read by `scripts/build-text-places.ts`), checked against that
language's Bible. Russian keeps its own case forms for the print quiz (`packages/model/src/russian-forms.ts`).

## 5. Check

`pnpm gate:full`, `pnpm e2e` (its steps find buttons by their Russian names, so it runs in
Russian), and a look at a place card, a tour and a printed sheet in the new language.
