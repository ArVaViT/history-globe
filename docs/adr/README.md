# Architecture decisions

Each decision that is expensive to reverse has a record here (ADR 0001). A record is not
edited after it is accepted, except to mark it superseded; a change of mind is a new record.
Read the superseding record first. New records start from [0000-template.md](0000-template.md).

| ADR                                                     | Decision                                                           | Status                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| [0001](0001-record-architecture-decisions.md)           | Record architecture decisions                                      | accepted                                    |
| [0002](0002-monorepo-and-toolchain.md)                  | Monorepo and toolchain                                             | superseded by 0020                          |
| [0003](0003-time-model.md)                              | Time model                                                         | accepted                                    |
| [0004](0004-map-engine.md)                              | Map engine                                                         | accepted; partly superseded by 0020         |
| [0005](0005-tiles-and-terrain.md)                       | Tiles and terrain pipeline                                         | superseded by 0020                          |
| [0006](0006-frontend-and-embedding.md)                  | Frontend and embedding                                             | accepted; partly superseded by 0020         |
| [0007](0007-content-as-code.md)                         | Content as code                                                    | accepted                                    |
| [0008](0008-data-licensing-policy.md)                   | Data licensing policy                                              | accepted                                    |
| [0009](0009-backend-phasing.md)                         | Backend, in phases                                                 | accepted; Phase 1 superseded by 0012        |
| [0010](0010-quality-gates.md)                           | Quality gates                                                      | accepted; partly superseded by 0020         |
| [0011](0011-maplibre-unbundled-and-the-js-budget.md)    | MapLibre ships unbundled; the JS budget counts its worker          | accepted; budget figures superseded by 0021 |
| [0012](0012-vercel-and-supabase.md)                     | Vercel for the site, Supabase for the data                         | accepted                                    |
| [0013](0013-the-ancient-world-layer.md)                 | The ancient world around the Bible, as its own quieter layer       | accepted; its own layer superseded by 0018  |
| [0014](0014-open-data-closed-code.md)                   | Open data, closed code                                             | accepted; amended by 0016                   |
| [0015](0015-every-language-equal.md)                    | Every language equal                                               | accepted                                    |
| [0016](0016-articles-and-questions-under-by-nc-nd.md)   | The articles and the questions under CC BY-NC-ND; no training      | accepted                                    |
| [0017](0017-canary-marks-and-the-notice.md)             | Canary marks in what is published, and one notice                  | accepted                                    |
| [0018](0018-one-world-of-places.md)                     | One world of places                                                | accepted                                    |
| [0020](0020-toolchain-data-and-checks-as-built.md)      | Toolchain, data, frontend and checks as built                      | accepted                                    |
| [0021](0021-the-js-budget-per-reader.md)                | The JS budget: 440 kB before the first frame, one language counted | accepted                                    |
| [0022](0022-one-place-one-record-old-ids-as-aliases.md) | One place, one record: a merged record's id lives on as an alias   | accepted                                    |
