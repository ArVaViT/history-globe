# 0019. The code under the AGPL

- Status: accepted (supersedes ADR 0014 for the code; amends ADR 0016)
- Date: 2026-11-18

## Context

ADR 0014 kept the code, the documentation and the design "all rights reserved" so that no
platform could take the globe whole. Since then ADR 0016 has put the articles and the
answers, the part a copy of the site is really made of, under CC BY-NC-ND, and ADR 0017 has
made a copy of them provable. What the closed code still protected was the program: a
renderer, a build and a pipeline that a reader could study on GitHub but not use. The
project gains more from code that scholars, Bible apps and classrooms can run, audit and
improve than from code they may only read. Every commit so far has one author, so the
licence can change without anyone else's consent.

## Decision

- **The code is AGPL-3.0-or-later** (`LICENSE`, part 1; the text in `COPYING`): the apps,
  the packages, the scripts, the pipeline, the tests, the configuration and the documentation
  of the project. Version 3 or, at the user's option, any later version the Free Software
  Foundation publishes, so that the code can follow the licence as it is revised without
  asking every contributor again.
- **Two additional terms under section 7.** (b) A modified version keeps the attribution
  "History Globe by Vadym Arnaut", with a link to https://historyglobe.app, in the notice or
  "about" information it shows its users. (e) The licence grants no right to the name
  "History Globe" or its logo: a copy goes under a name of its own.
- **The source is offered to every user** (section 13): the Settings panel, the footer of
  every built page and of the documentation link to the repository, and the notice in the
  head of every page names the licence and the repository.
- **What runs inside other sites is permissive.** `hg-places.js` and its released versions
  are MIT, and the code examples on the documentation pages are CC0, so that a page that
  uses them takes on no obligation of the AGPL. The embed (`/embed/v1`) needs no exception:
  it is served by the site and only framed by the host page.
- **The rest stays as decided.** The articles and the answers stay CC BY-NC-ND 4.0, with
  text and data mining reserved for them alone (ADR 0016); the data stays CC BY 4.0
  (ADR 0014); the reviews belong to their authors; the name, the logo and the preview images
  stay reserved. The reservation of text and data mining no longer covers the code: the
  AGPL forbids further restrictions (sections 7 and 10).
- **The beacon is the production build's alone** (ADR 0017): a build from the source for
  any other address carries no script that reports to historyglobe.app.

## Alternatives considered

- **Keep the code closed** (ADR 0014). The articles are what a copy is made of, and they
  have their own licence now; the closed code mainly kept away the people who would help.
- **MIT or Apache-2.0.** A platform could take the globe, change it and serve it without
  sharing a line back. The AGPL lets anyone run it and asks only that improvements served to
  users come back to them.
- **GPL-3.0.** The globe is used through a browser: the GPL's duty to share the source does
  not reach a site that is only served, which section 13 of the AGPL does.
- **AGPL-3.0-only.** Keeps a later version of the licence from applying without a
  decision, but once the code has other contributors, moving to that version would need the
  consent of every one of them; a fix the Free Software Foundation makes to the licence
  could then not reach the code.

## Consequences

- ADR 0014 no longer holds for the code: its "the code stays the moat" and its alternative
  rejecting the AGPL are withdrawn. Code published before this decision, read under "all
  rights reserved", is under the AGPL as well, history included.
- A copy of the site built from the source is lawful under the AGPL, but it carries none of
  the articles unless it keeps their licence, and it goes under its own name. The notice in
  every page, `llms.txt` and the Build page in every language say so.
- A contribution comes in under the licence of the part it lands in (`CONTRIBUTING.md`,
  Developer Certificate of Origin); no copyright assignment is asked. Licensing the code
  under other terms later would need every contributor's consent.
- A new dependency must be under a licence compatible with the AGPL; those in use are
  (MIT, ISC, BSD, Apache-2.0, MPL-2.0 at build time, OFL for the fonts).
