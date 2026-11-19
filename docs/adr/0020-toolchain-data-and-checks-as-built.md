# 0020. Toolchain, data, frontend and checks as built

- Status: accepted
- Date: 2026-11-18

## Context

ADRs 0002, 0004, 0005, 0006, 0009 and 0010 were written on 2026-09-28, before the code. Much
of what they name was never built (knip, lefthook, uv, ruff, mypy, PMTiles, Cloudflare R2 and
Pages, Radix, i18next, a visual regression suite, CI running the gate), and some of it was
replaced by later ADRs. Read as binding, they would send an agent to add tools nobody chose to
keep. This ADR records what is built and supersedes the parts of those ADRs that differ.

## Decision

### Toolchain (supersedes ADR 0002)

- One repository with pnpm workspaces (`apps/web`, `packages/core`, `packages/model`) and no
  task runner. Node 24.11+ (`engines`); pnpm pinned in `packageManager` and run through
  corepack.
- TypeScript in strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax` and `erasableSyntaxOnly`, checked once over the root
  `tsconfig.json`, which covers the apps, the packages and `scripts/`. ESLint with
  typescript-eslint `strictTypeChecked` and react-hooks; Prettier; Vite with plugin-react;
  Vitest with fast-check. Warnings fail.
- No knip, no git hooks: the gate is a command (`pnpm gate`) and a CI job (below).
- Python 3.11+ with the standard library only, for everything `pnpm data` and
  `pnpm test:pipeline` run; its tests use `unittest`. No uv, ruff, mypy or pytest. A script
  run once by hand whose output is committed may need more, and says so in its docstring
  (`pipeline/rivers/riveratlas_rivers.py`: shapely and pyogrio).
- Playwright and axe-core are dev dependencies for the browser checks (`e2e/README.md`);
  Playwright's Chromium is downloaded separately.
- The tools ADR 0002 deferred keep their triggers.

### Data and terrain (supersedes ADR 0005)

- No vector tiles. The data release is GeoJSON and JSON in `apps/web/public/data`, built by
  `pnpm data` (`pipeline/build_data.py` and `scripts/`) and served as static files beside the
  app; MapLibre tiles the GeoJSON in the browser. No tippecanoe, PMTiles, DuckDB, GDAL or
  `just`.
- The relief comes from Mapterhorn's public tile host (Terrarium WebP, `TERRAIN_TILES` in
  `apps/web/src/offline.ts`). A copy of our region on our own host is still open: it would
  remove a third party that sees every reader's IP address.
- Unchanged from 0005: each dataset is a dated snapshot with its licence (ADR 0008), and
  neither the downloads (`pipeline/.cache`) nor the release is committed.

### Hosting and the database (ADR 0009's first phase is superseded by ADR 0012)

- `db/` holds the schema and a loader. No deploy loads the database and no check compares it
  with the release; the migration check of ADR 0007 waits until the database becomes the
  source of the data.

### Frontend (supersedes parts of ADR 0006)

- React 19 and Tailwind 4 with components of our own; no Radix, shadcn or lucide-react (the
  icons are inline SVG, ADR 0011). Fonts are self-hosted from Fontsource: Literata, Golos
  Text and Onest.
- No i18next: a small `t()` over one JSON file per language (`apps/web/src/i18n`), its keys
  kept equal across languages by a test. The languages are `LOCALES` in
  `packages/model/src/time.ts` (ADR 0015).

### Map engine (supersedes parts of ADR 0004)

- MapLibre stays pinned to an exact version. An upgrade is a PR of its own that passes
  `pnpm gate` and the browser checks (`pnpm e2e`, `pnpm e2e:a11y`); there is no visual
  regression suite.
- The style is validated with the style-spec validator in the unit tests
  (`packages/core/src/style.test.ts`), so CI runs it.
- `prefers-reduced-motion` is honoured. There is no `static` or `lite` mode: a globe that
  cannot start shows an error, and an embed sends `hg:error`.

### Checks (supersedes parts of ADR 0010)

- `pnpm gate`: format, lint, types, unit and pipeline tests, the content checks, links, the
  build, the CSP hashes and the JS budget. `pnpm gate:full` runs `pnpm data` first.
- CI (`.github/workflows/ci.yml`, job `ci-pass`) runs on every pull request the part of the
  gate that needs neither the data release nor a secret: format, lint, types, the unit tests
  except the one that reads the release, and the pipeline tests. The full gate runs locally
  before every merge.
- The browser checks (`e2e/`) run against a running app, apart from the gate.
- Not built: visual regression tests, CodeQL, RUM and the error budgets. Visits are counted
  by Vercel Web Analytics, without cookies.
- The JS budget is ADR 0011 as amended by ADR 0021.

## Alternatives considered

- Editing the old ADRs in place: ADR 0001 forbids it, and the old text is the record of what
  was planned.
- Building what the old ADRs promised: each of those tools would cost more to keep than the
  problem it solves today; the triggers in ADR 0002 stand for when that changes.

## Consequences

- ADRs 0002 and 0005 are superseded; 0004, 0006 and 0010 are partly superseded. ADR 0012
  replaced the first phase of 0009; its later phases stay the plan for an API, as 0012 says.
- A tool named here as absent comes in only with a new ADR (AGENTS.md).
- The ruleset can require `ci-pass` once the job has run on `main`.
