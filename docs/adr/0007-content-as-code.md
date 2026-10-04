# 0007. Content as code

- Status: proposed
- Date: 2026-09-28

## Context

The curated content — what each place was in each century, disputed locations and
datings with named proponents, articles where every sentence is backed by a source —
is the product's real value. A trial of three reference articles showed that no article
passes an independent review on the first try, and that a writer → reviewer → editor →
second-pass loop converges (95 of 95 evidence snippets confirmed in their sources).

## Decision

- **Source of truth is files in git** under `content/`: YAML for structured records
  (places, place states, candidates, events, dating views, routes), Markdown for article
  bodies. Every change goes through a PR and CI.
- **The single schema is Zod in `packages/model`.** JSON Schema is generated from it for
  the Python pipeline; future SQL migrations are checked against it in CI, never the
  other way round.
- **Ids are immutable once published** and never reused:
  - a **place** is the biblical place (`capernaum`, `emmaus`);
  - a **site** is a candidate location for it (`emmaus~emmaus-nicopolis`,
    `emmaus~qubeibeh`), with its own confidence and proponents;
  - an **article** is `<place>@<century>` (`capernaum@c+01`, `jerusalem@c-10`).
    Renames happen through an alias table, never by editing an id.
- **Place names are data**: one record per place × language × period (Hebrew, Greek,
  Latin, en, ru — Synodal spelling stored separately from the modern one —, uk, de).
  Tiles carry only the id and the name in each shipped locale.
- **Schema versioning**: every release carries `schema_version`; a breaking change bumps it
  and ships a migration script for `content/`.
- **Citations are first-class**: each claim links to a source, a locator (page, section,
  `Ant. 15.11.3`) and a verbatim evidence snippet. Because the repository is public,
  **snippets from copyrighted sources are at most 25 words and nothing more** — no wider
  context in the repository. Fuller context and source snapshots, where kept at all, live
  outside git. Snippets are never shown to readers.
- **CI checks the meaning, not just the shape**: every verse reference exists; every
  snippet is found in the saved source; confidence labels follow the rules in
  `docs/content-guide.md`; no service notes in reader text; nothing from a share-alike source.
- **Review pipeline for articles**: writer model → automated checks → reviewer model →
  edit → second pass on changed parts → lead written last → scholar review → translation.
  Master language is English; Scripture is quoted from licensed translations, never
  machine-translated.

## Alternatives considered

- A CMS (Sanity, Payload, Directus): weaker review and diff workflow, document limits,
  and our checks would live outside CI. Keystatic can be added on top of git later for
  non-technical editors.
- Database as the source of truth: no diffs, no PR review, harder for agents.

## Consequences

- While the repository is public, all committed content is public too — including
  articles, review notes and prompts. The owner accepted this and will make the
  repository private once the content becomes valuable; anything published before
  that stays public through forks and archives.
- Git on GitHub is the primary copy of the content; a periodic mirror goes to the
  owner's archive disk.
- Full copies of sources are stored only when they are public domain or openly
  licensed; otherwise a URL, a hash and our snippet.
