# 0004. Map engine

- Status: proposed
- Date: 2026-09-28

## Context

The prototype proved MapLibre GL JS 6 in globe projection with terrain, color relief,
multidirectional hillshade and a `global-state` year filter. Measured on 2026-09-28:
changing the year re-filters in the worker and keeps 60 FPS on the main thread with
20 000 labelled points; `feature-state` on the same set drops to 26 FPS under 4× CPU
throttling. deck.gl adds about 233 KB gzip and draws at sea level, not on terrain.

## Decision

- **MapLibre GL JS 6, exact version pin** (6.11.2 at the time of writing); upgrades only
  through a PR that passes the visual regression suite.
- **Own engine core** in `packages/core`, framework-agnostic: commands in, events and a
  state snapshot out. **The engine store is the only store of globe state** (year, place,
  camera, layers, tour step); React reads it through one hook. No Zustand, no XState,
  until a real need appears. Rendering sits behind a `Renderer` port with two implementations:
  `MapLibreRenderer` and `FakeRenderer` for fast unit tests without WebGL.
- **Year filtering via `global-state`**; `feature-state` only for hover and selection.
  Budget: at most 5 000 dated features in view.
- **Style written in TypeScript** (`buildStyle(tokens, theme, locale, quality)`), validated
  with the MapLibre style-spec validator in CI. Theme changes use `global-state`, not
  tile rebuilds.
- **Labels with `font-faces`** and self-hosted WOFF2 (Literata for Latin, Cyrillic and
  polytonic Greek; Noto Serif Hebrew), all OFL. Hebrew without niqqud on the map.
  Fallback: PBF glyphs.
- **No deck.gl.** Routes are drawn with `line-gradient` over `line-progress`. three.js
  only as a lazily loaded custom layer for rare 3D accents.
- **Degraded modes**: `static` (era images + place list) when WebGL fails, `reduced`
  under `prefers-reduced-motion`, `lite` when measured FPS stays low.

## Alternatives considered

- **CesiumJS**: about six times heavier, GIS look by default, commercial ion pricing.
- **Mapbox GL**: proprietary licence and a token even for self-hosted tiles.
- **@vis.gl/react-maplibre**: pins an older style-spec; our own thin binding is simpler.
- **Custom three.js globe**: best control, years of work for one person.

## Consequences

- MapLibre 6 is young (11 minor releases in two months): the pin and the visual suite
  are mandatory, not optional.
- Real-phone performance is still unmeasured; the first spike must run on an iPhone 12
  class device and a mid-range Android.
