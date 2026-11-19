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
3. Sign off every commit (`git commit -s`); see below.
4. Run `pnpm gate` and read its output; CI runs the part of it that needs no data.
5. Fill in the pull request checklist.

A decision recorded in `docs/adr/` is changed only by a new record that supersedes it.

A new dependency must be under a licence compatible with AGPL-3.0 (MIT, ISC, BSD,
Apache-2.0, MPL-2.0, OFL for fonts, and the like). Data comes only from the allowlist of
ADR 0008: public domain, CC0, CC BY or ODC-BY; nothing share-alike or non-commercial.

## How a contribution is licensed

What you contribute is licensed as the part of the repository it lands in (`LICENSE`):
code under AGPL-3.0-or-later with its section 7 terms, data under CC BY 4.0, an article or an
answer under CC BY-NC-ND 4.0. Nobody is asked to assign copyright.

The `Signed-off-by` line that `git commit -s` adds certifies the
[Developer Certificate of Origin](https://developercertificate.org/): that you wrote the
change or have the right to submit it under that licence.
