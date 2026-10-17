# 0016. The articles and the questions under CC BY-NC-ND; no training

- Status: accepted (amends ADR 0014)
- Date: 2026-10-17

## Context

ADR 0014 put every text in `content/` under CC BY 4.0 so that other platforms would use
the data and the API rather than copy the globe. A survey of what the site gives away
(2026-10-17) showed that the place articles and the answered questions, 746 and 200 texts
in eleven languages, are the part a copy of the site would be made of, and that CC BY
lets anyone take them whole into another site, a dataset or a training set, with a credit
line. The owner wants the data used and the globe not copied: the articles and their
translations are the globe. He also decided that the content is not training data; it
reaches readers through the site and through the assistants that cite it.

## Decision

- **The articles and the questions: CC BY-NC-ND 4.0** (`LICENSE`, part 1): the place
  articles and the questions with their answers, in every language, and what the build
  makes of them (`data/articles/`, the article text on the place pages, the question
  pages, `api/v1/questions.json`). Readers quote, link and share them as they are, with
  credit, not for money; nobody changes, translates or republishes them.
- **The rest of the data stays CC BY 4.0** (part 2): names in every language, tours,
  events, battles, the years of towns, the notes of ancient authors, the photo records and
  the open API but for `questions.json`. The API keeps its licence and its credit lines;
  its index names the exception.
- **The code, the documentation and the design stay all rights reserved** (part 3, as in
  ADR 0014).
- **Text and data mining is reserved** (Article 4(3) of Directive (EU) 2019/790) for parts
  1 and 3. Its machine-readable form: `robots.txt` disallows the crawlers that gather
  training text and carries `Content-Signal: search=yes, ai-input=yes, ai-train=no`; every
  page is sent with `tdm-reservation: 1` (`vercel.json`). Search engines and the
  assistants that answer with a citation stay allowed (`docs/launch-readiness.md`, section 4).
- **Copies already made keep their licence.** A Creative Commons licence is not revocable:
  what was taken under CC BY before 2026-10-17 stays under CC BY. The new licence applies to
  what is published from that date on, which is why it is applied now, while copies are few.

## Alternatives considered

- **Everything NC-ND.** Would close the API to the scholarly partners ADR 0014 was written
  for (Pleiades, World Historical Gazetteer, Bible apps), who need to mix the data with
  their own.
- **CC BY-SA for the texts.** Share-alike does not stop a copy of the site; it only makes
  the copy open too.
- **No licence change, technical measures only.** A static site with every text in a few
  JSON files cannot stop a copy technically (the survey's conclusion); a licence gives a
  ground to ask a host to take a copy down, which CC BY did not.

## Consequences

- A community translation or a partner's republication of an article needs a written
  licence from the owner; that is intended (one licence for all, individual ones for
  partners).
- `questions.json` stays in the API for the sites that read it, under its own licence,
  stated in `index.json`, the OpenAPI description and the API page.
- The WebMCP `get_place` tool labels the article it returns with its licence.
- `robots.txt` stops the crawlers that read it; one that does not is stopped by nothing
  here. A rate limit on the data and the pages, and a honeypot, are the next step and a
  hosting setting, not code.
- The first stage of the same decision also stops publishing what made a copy cheap: the
  source maps, the list of every file (`offline.json`) and the whole book of articles in
  one file (`articles.json`); the articles come one language a file.
