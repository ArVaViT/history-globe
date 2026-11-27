# Contributing

Corrections, reviews and code are welcome. Read `AGENTS.md` first: it is the contract for
every change, by a person or an agent.

Everyone who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md) (the Contributor
Covenant); report a breach to historyglobe.vadym@gmail.com.

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
ADR 0008: public domain, CC0, CC BY or ODC-BY; nothing share-alike or non-commercial reaches
the site, the API or the dataset. The one share-alike part of the repository is the two
crosswalk tables in `docs/crosswalk/`, which cite Theographic's record ids and are under its
CC BY-SA 4.0 (`LICENSING.md`, part 4).

## How a contribution is licensed

You keep the copyright in what you contribute; nobody is asked to assign it, and there is no
contributor licence agreement. By submitting a contribution you license it as follows
(`LICENSING.md`, part 8):

- **Code** under AGPL-3.0-or-later, with the additional terms under its section 7, as the code
  is (a change to `hg-places.js` under MIT, a code example in the documentation under CC0, as
  those files are).
- **Articles, answers, data and other texts** under CC BY 4.0. The maintainer may then edit
  and translate them and publish them with the rest of their part, under its licence (for an
  article or an answer, CC BY-NC-ND 4.0), and may give partners further licences. What you
  submitted, as you submitted it, stays available under CC BY 4.0.
- **A review** stays yours, under the licence you give it.

The `Signed-off-by` line that `git commit -s` adds certifies the
[Developer Certificate of Origin](https://developercertificate.org/): that you wrote the
change or have the right to submit it under these licences.
