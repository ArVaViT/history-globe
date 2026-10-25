# Reviews by scholars: how a review goes from a letter to the site

The policy readers see is `content/docs/<lang>/reviews.html` (https://historyglobe.app/docs/reviews.html).
This is the working side of it. What we send a reviewer: [brief.md](brief.md) and
[checklist.md](checklist.md), with the packet below.

## 1. The packet

When the scope is agreed (5–15 articles of one region or period), commit any pending edits to
those texts, then:

```sh
PLAYWRIGHT=<a folder with playwright installed> \
  node scripts/review-packet.ts --scope "Lycus valley" colossae laodicea q:<question id> tour:<tour id>
```

It writes to `pipeline/out/review-packets/<date>-<scope>/` (outside git):

- `packet.pdf` — "History Globe — Articles for review — <scope> — version of <date> (<commit>)":
  numbered paragraphs, the sources under each article, a wide right margin for notes;
- `packet.html` — the same, to print from a browser if Playwright is not at hand;
- `links.md` — each item's live page and its file at that commit, for the letter;
- `items.yaml` — the `version` and `items` (with the hash of each item's English text in this
  version) for the review's file, step 3. Keep it with the letter.

## 2. Answer, then the public text

Answer every point within two weeks; correct the texts in all 16 languages. Then send the exact
public entry for approval (name, title, institution, scope, statement, conflicts, licence, DOI
yes/no). Nothing is published before the reviewer replies "Approved". Keep the approved text and
the reply in the author's private files, never in this repository.

## 3. Publishing: one file

Copy [review-template.yaml](review-template.yaml) to `content/reviews/<id>.yaml` (the id is the
review's month and a short name, `2026-11-lycus-valley`, and is in its address), fill it in, and
paste `version` and `items` from the packet's `items.yaml`. The consent's `text_sha256` is the
fingerprint of the approved text: `shasum -a 256 approved.txt`.

Corrections made in answer to the review change the texts after the version read. Run the packet
script again on the corrected commit and add each new hash to that item's `accepted` list, so the
page does not say "changed since" for the reviewer's own corrections. Any later change does.

`pnpm content` checks the file (unknown fields, dates in order, a real ORCID iD, every item
existing) and builds:

- the line under each covered article's, question's or tour's title in every language
  ("Reviewed by …, … · date · Read the review →", "changed since" when its English text has
  changed since the version read), in the static pages and in the app's card;
- `/<lang>/reviews/` and `/<lang>/reviews/<id>/`, with the statement in its original language,
  our response, the versions, "Cite this review" and schema.org `Review` data (no rating).

With no file in `content/reviews/` none of these pages exist and nothing links to them.

## 4. Withdrawal

On a reviewer's request, delete the file and add a line to the commit message: "a review was
withdrawn at the reviewer's request". A Zenodo DOI cannot be deleted; say so before creating one.
