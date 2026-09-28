# 0002. Monorepo and toolchain

- Status: proposed
- Date: 2026-09-28

## Context

One developer and AI coding agents build a web app that is also the embed for Equip
(ADR 0006), a Python geo pipeline, and later an API. Agents need one place to look,
one command to verify, and strict, fast feedback. A review of the first draft of this
ADR showed it carried tools the MVP does not need; this version is the lean one, with
explicit triggers for adding more. Versions checked against registries on 2026-09-28.

## Decision

One repository, pnpm workspaces, no task runner (`pnpm -r --filter`).

```text
apps/web            the app; also serves /embed/v1 (Vite SPA)
packages/model      the single schema (Zod) and the time model (ADR 0003)
packages/core       framework-agnostic globe engine (ADR 0004)
pipeline/           Python: dataset imports and tile builds only (own uv.lock)
content/            curated records and articles (ADR 0007)
docs/               ADRs, attributions, legal questions
```

| Layer     | Choice                                                                                | Version                        |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| Runtime   | Node.js LTS in CI and production, pinned by `devEngines.runtime` + `onFail: download` | 24.x (`>=24.11 <27`)           |
| Packages  | pnpm, pinned in `packageManager` (plain `npx pnpm` would fetch 12)                    | 11.27.x                        |
| Types     | TypeScript, same line as Equip                                                        | 6.0.x                          |
| Lint      | ESLint + typescript-eslint `strictTypeChecked` + react-hooks                          | 10.11 / 8.70                   |
| Format    | Prettier                                                                              | 3.9.x                          |
| Build     | Vite + plugin-react                                                                   | 8.3.x                          |
| Dead code | knip                                                                                  | 6.x                            |
| Git hooks | lefthook: pre-push runs the fast gate                                                 | 2.1.x                          |
| Python    | CPython + uv + ruff + mypy `--strict` + pytest                                        | 3.14 / 0.12 / 0.16 / 2.3 / 9.1 |

TypeScript strictness beyond `strict`: `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.
Warnings fail the build.

## Deferred, with the trigger that brings each in

| Tool                                | Add when                                              |
| ----------------------------------- | ----------------------------------------------------- |
| Turborepo                           | `pnpm gate` takes longer than ~2 minutes locally      |
| TypeScript 7 (`tsgo`)               | typescript-eslint supports it — no dual-version setup |
| tsdown, Changesets, GitHub Packages | a partner needs an npm package instead of the iframe  |
| Web component                       | a paying partner asks for it                          |

## Alternatives considered

- Separate repositories for code and content: rejected by the owner for now.
- npm workspaces: no catalogs, weaker isolation. Nx: too heavy.
- Biome / oxlint: type-aware coverage still incomplete; revisit January 2027.

## Consequences

- Hosting never runs pnpm: the app is built in GitHub Actions and deployed prebuilt.
- Python is limited to geodata; it stores years as plain integers and never re-implements
  the time model.
