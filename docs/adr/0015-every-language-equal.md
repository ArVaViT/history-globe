# 0015. Every language equal

- Status: accepted
- Date: 2026-10-11

## Context

The project began in Russian and English, and Russian stayed the site's own language after
nine more joined: a link without `?locale=` opened the map in Russian whatever the reader's
browser said; the app's page, its manifest, the 404 page and the picture shown when a link is
shared were Russian; the language switch listed Russian first; the open API gave place names
in English and Russian only; and Russian words sat in the code beside the English while the
other languages' came from their own files. The owner wants an international product in
which no language ranks above another.

## Decision

- **The reader's language.** A link that names no language opens in the one the reader
  picked before in the settings, else the first of the browser's languages the site is
  published in (`pt-BR` → Portuguese), else English (`apps/web/src/url.ts`,
  `preferredLocale`). A link's `?locale=` always wins. A map embedded in another site without
  `?locale=` takes the browser's language, never the one picked on this site
  (`startLocale`): the host's page decides. English is the fallback because it is
  the language most readers of other languages read, not the site's own.
- **Words per language, Russian among them.** Book abbreviations and names, era names, the
  site-label templates, the year and century formats (since 2026-10-23) and the Maccabees
  mark of every language but English live in
  `packages/model/src/locales/<code>.ts`, fetched with that language
  (`locale-data.ts`, ADR 0011). English is in the code, as the words the others fall back to.
- **No first language in lists.** `LOCALES` runs in the order of the languages' own names
  (Čeština … English … Русский, Українська), and so do the language switch, the pages'
  language menus, the sitemap and `llms.txt`.
- **Neutral entry points.** The app's page, the manifest, the 404 page and the old About
  link are in English and list every language; the shared-link picture is the map in the
  page's language (`og/<code>.jpg`), English for the app's own page.
- **The open API in every language.** `places.json` gives `names` in every language and a
  page in each; `name_ru` stays for the sites that read the first version.

Russian keeps what belongs to Russian itself: the Synodal numbering of its references, its
case forms in the quiz and the text-places script, and the Synodal translation as the source
of its names. Each is a property of the language, as the Kralice Bible is of Czech.

## Alternatives considered

- **English as the default for everyone, without the browser's language.** Simpler, but a
  German reader would land on English and have to find the switch.
- **Keeping Russian in the code beside English.** It saved a file, and it made Russian the
  only language a module could not do without.

## Consequences

- A new language needs its file in `locales/`, its place in `LOCALES` by its own name, its
  link in the hand-written pages (`apps/web/src/static-pages.test.ts` fails until it is
  there) and its preview picture.
- The content is still written in Russian and English first and translated from English;
  that is how the texts are made, not something a reader sees.
- Text places (`hg-places.js`, the cards' verses, the static pages) know every language
  since 11.10.2026: each language's names, their case forms in Ukrainian, Polish and Czech
  and the German genitive (`scripts/inflected-forms.ts`), checked against that language's
  Bible and read by eye by a reviewer of the language (`scripts/build-text-places.ts`). The
  old Bibles the verse cards quote spell some names the old way (Gdańsk «Filipowa»), so
  those verses link fewer places than a modern text does.
