# 0006. Frontend and embedding

- Status: proposed
- Date: 2026-09-28

## Context

The globe must live inside Equip first (React 18.3, Tailwind 3 with an unlayered reset,
strict CSP, deployed on Vercel), later inside other LMSs. The first draft chose an npm
React package for Equip. A review showed that this single choice drags in a React 18/19
test matrix, CSS isolation tricks against Tailwind 3, a library build, Changesets,
GitHub Packages with a classic token in Vercel, and CSP changes — while in Phase 1 all
data is public anyway, so the package buys no auth advantage.

## Decision

- **One app, one embed: an iframe.** `apps/web` is a Vite SPA; `/embed/v1` renders the
  same globe without app chrome. Equip embeds it with an `<iframe>`; other LMSs do the
  same; LTI 1.3 later wraps the same page.
- **Versioned contract.** The path carries the major version (`/embed/v1`). URL
  parameters and the `postMessage` protocol (`hg:ready`, `hg:view-changed`,
  `hg:verse-clicked`, `hg:set-view`, each with `v: 1`) are specified in
  `docs/embed-protocol.md` and covered by tests. Breaking changes mean `/embed/v2`,
  with v1 kept alive for at least six months.
- **One `GlobeView` codec** (year, place, camera, layers) shared by the URL, the iframe
  protocol and Equip's future `map` lesson block.
- **Licensing of embeds** in Phase 2 is enforced with `frame-ancestors` per partner domain.
- **UI**: React 19, Tailwind 4 (no prefix needed — the iframe isolates CSS), Radix and
  copied shadcn components, lucide icons. Fonts: Literata (Latin, Cyrillic, polytonic
  Greek), Golos Text for UI, Noto Serif Hebrew.
- **i18n**: i18next 26 with typed keys and CI key coverage; locales `en`, `ru`, `uk`, `de`.
  UI strings live in i18n files; place names and articles live in data.
- **Accessibility**: WCAG 2.2 AA. The keyboard and screen-reader path is a visible list of
  places; the slider announces years in words; reduced-motion and no-WebGL modes.

## Deferred, with triggers

| Item                     | Add when                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| React package for hosts  | a partner needs deeper integration than an iframe allows                                      |
| TanStack Router / Query  | the app grows beyond the globe plus a few panels                                              |
| Astro public SEO pages   | content is valuable enough to market, and the repository question (public/private) is settled |
| Motion, three.js accents | a concrete design needs them                                                                  |

## Alternatives considered

- React package first: see Context. Web component: only for a paying partner.
- TanStack Start / Next.js / React Router 8: server features we do not need; RR 8 needs
  React 19.2.7+.

## Consequences

- Equip changes are small: an `<iframe>` in a lazy route, one `frame-src` entry in its CSP,
  and a message handler for verse clicks.
- An iframe cannot share Equip's login; fine in Phase 1, solved by signed view tokens in
  Phase 2 (ADR 0009).
