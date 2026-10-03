# 0011. MapLibre ships unbundled; the JS budget counts its worker

- Status: proposed
- Date: 2026-09-30

## Context

MapLibre GL JS 6 is three ES modules: the library, its web worker, and a module both
import. The library finds its worker with `new URL("./maplibre-gl-worker.mjs",
import.meta.url)` built from a template at run time. A bundler cannot follow that URL:
in the production bundle the worker was a 404, no tile or GeoJSON was ever parsed, and
the page showed an empty globe until its 8-second fallback. The development server
serves `node_modules` as they are, so neither development nor the end-to-end runs saw it.

The JS budget of ADR 0010 (400 kB gzip before the first frame) had passed at 384 kB
because the worker was never shipped. Counted honestly, with the worker built by Vite
as a separate entry that repeats the shared module, the first frame needed 532 kB; with
MapLibre's own three files, 417 kB.

## Decision

- The build marks `maplibre-gl` external and ships MapLibre's three files unchanged
  under `vendor/maplibre-gl-<version>/` with their licence and source maps
  (`apps/web/vite.config.ts`). The shared module is downloaded once, for the page and the
  worker. Development is unchanged.
- `scripts/check-budget.ts` counts those files, the worker included, and fails if the
  worker is missing from the build.
- To come back under 400 kB without losing features: i18next and react-i18next are
  replaced by a small `t()` with placeholders and `Intl.PluralRules`
  (`apps/web/src/i18n/index.ts`); the verse table leaves the browser (`checkRef` in
  `packages/model/src/verses.ts`, used by the schemas and the build); lucide-react gives
  way to the fifteen icons as inline SVG, their ISC and MIT notices in
  `public/licenses/`. The total was 399.6 kB; by the end of that day, with the flight
  padding and the selected-place label, 399.9 kB.
- Before any deploy, the built app is loaded (`vite preview`) and the in-view list must
  fill: it does only when the worker runs.

## Alternatives considered

- **Let Vite build the worker** (`?worker&url` and `setWorkerUrl`): works, but the worker
  bundle repeats the shared module: 532 kB.
- **Raise the budget** to fit: possible, and still open (see Consequences); the three
  replacements above were cheap and kept every feature.
- **Preact instead of React**: react-dom is 70 % of the main chunk; about 55 kB less. A
  larger change to ADR 0006, left for a decision of its own.

## Consequences

- The budget has well under 1 kB left: new interface features need room first, either a
  higher budget in ADR 0010 or the Preact move.
- A MapLibre upgrade changes the vendor path by version, so browsers fetch it afresh.
- The i18n module is ours to maintain: nested keys, `{{name}}`, plural forms; a missing
  key falls back to English, then to the key itself.

## Update, 30.09.2026 evening

The product owner asked for a settings window, a speed control in the player and a
timeline that zooms with a trackpad. With 0.1 kB left they could not fit, so the budget is
raised to 420 kB (`scripts/check-budget.ts`). The Preact move stays open as the way back
under 400.

## Update, 03.10.2026 night (proposed, for the product owner)

At 419.94 of 420 kB (about 60 bytes left) the first frame has no room for another interface
feature. Every feature of that night that could wait was put in a chunk loaded on demand
(hover tips, the menu panel, the embed protocol, the lesson, the search, the leg relief in
the tour card); what remains in the first frame is MapLibre (303 kB), react-dom and the
app's own entry (`index`, 82.6 kB, most of it `App.tsx`).

Options, in the order recommended:

1. **Raise the budget to 440 kB now** (one line in `scripts/check-budget.ts`): room for a
   few more features while the next two are weighed. The first frame on a slow 4G link
   grows by about a tenth of a second.
2. **Split `App.tsx`** when it is next worked on: the left column's wiring, the embed bar
   and the print and picture handlers can load after the first frame; an estimated
   10–15 kB back, without a framework change.
3. **Preact** (about 55 kB less, see above): the largest gain and the largest change, a
   decision of its own.

## Decision, 03.10.2026 morning

The product owner chose option 1: the budget is 440 kB (`scripts/check-budget.ts`), to finish
the remaining features (a Bible-only setting, battles, an open verse-to-places API) before
launch. Splitting `App.tsx` and Preact stay the ways back down.
