# Contributing

Corrections, reviews and code are welcome. Read `AGENTS.md` first: it is the contract for
every change, by a person or an agent.

## Errors of fact

An error in a place, article, question or tour is best reported, not patched: open an issue
with the "Report an error" form, or write to historyglobe.vadym@gmail.com. Quote what is wrong
and give the source that shows it. Every text exists in every language of the site, and a
correction is made in all of them at once.

## Code and data

1. Set up as the README says (For developers). No account or key is needed.
2. Work on a branch; the PR title is a Conventional Commit (`fix(web): …`, `docs: …`), CI
   checks it. The types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `ci`,
   `build`, `style`, `revert`, and for this project `content` (articles, tours, events),
   `data` (the data build and its sources), `dataset` (the Hugging Face dataset) and `i18n`
   (translations).
3. Run `pnpm gate` and read its output; CI runs the part of it that needs no data.
4. Fill in the pull request checklist.

A decision recorded in `docs/adr/` is changed only by a new record that supersedes it.
Data comes only from sources under the licences ADR 0008 allows.

## Licence of contributions

A contribution is made under the licence that covers the files it changes (`LICENSE`).
