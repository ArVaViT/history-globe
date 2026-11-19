# 0021. The JS budget: 440 kB before the first frame, one language counted

- Status: accepted
- Date: 2026-11-18

## Context

ADR 0011 brought the JavaScript before the first map frame back under the 400 kB gzip of
ADR 0010, with under 1 kB to spare. Its later decisions were written into it as dated
updates, which ADR 0001 does not allow; this ADR restates them as one decision and takes
them out of 0011.

The settings window, the player's speed control and a timeline that zooms with a trackpad
did not fit in 400 kB, and the features planned before launch (a Bible-only setting, the
battles, an open verse-to-places API) did not fit in 420. Eleven languages then brought the
first frame to 438.5 kB, because every language's book names, era names and site-label
templates sat in the entry chunk, and the ceiling on all JS (560 kB) counted every language's
files although a reader fetches one. On a phone the largest paint of `/` came only after the
data and the map: Lighthouse (mobile, simulated 4G) put it at 9.4 s on the site.

## Decision

- **Before the first frame: at most 440 kB gzip** (`BUDGET_KB` in `scripts/check-budget.ts`).
  On a slow 4G link that is about a tenth of a second more than 400. The ways back down are
  splitting `App.tsx` (its left column's wiring, the embed bar, the print and picture
  handlers can load after the first frame) and Preact (about 55 kB less, a decision of its
  own, ADR 0011).
- **A language's words come with that language.** Book names and abbreviations, era names
  and site-label templates live in one file per language (`packages/model/src/locales`) and
  load with its dictionary (`apps/web/src/i18n`); English stays in the code as the fallback.
  The build scripts and the tests load every language first (`loadAllLocaleData`). A
  language added grows neither the first frame nor the total.
- **All JS: at most 560 kB gzip, counted per reader** (`TOTAL_KB`): the shared code and one
  language, the heaviest. `check-budget.ts` tells a language's chunks by their source maps,
  which the build keeps outside `dist/` (`apps/web/vite.config.ts`, `sourceMapsAside`).
- **The first screen comes before the first frame**, outside the budget's count:
  `index.html` draws the title bar itself (`#hg-shell`, the same in every language, ADR
  0015), which the app replaces with its own; Literata's Latin file is preloaded; the data
  and MapLibre are fetched once that screen is painted, at most two seconds later
  (`apps/web/src/first-paint.ts`); the relief's tile host is preconnected.

## Alternatives considered

- Holding 400 kB: every new interface feature would have waited for Preact.
- Counting every language in the total: each language added would have cost every reader.

## Consequences

- The same measurement after the first-screen change: largest paint 2.6 s, performance
  33 → 56; the rest is the map's own work.
- A feature that needs room in the first frame loads on demand, or comes with a change of
  this budget in a new ADR.
