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
