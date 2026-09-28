# 0003. Time model

- Status: proposed
- Date: 2026-09-28

## Context

Everything on the globe is filtered by year, from about 2000 BC to AD 100 at first.
Historians count 1 BC → AD 1 with no year zero; ancient dates are ranges, often
disputed. The prototype showed that a single integer year per object is fast in
MapLibre, but hides uncertainty.

## Decision

- **Astronomical integer years** everywhere in data and code: 1 BC = `0`,
  2 BC = `-1`, AD 1 = `1`. Conversion to "BC/AD" happens only at display time, in one
  module (`packages/model/time`), mirrored in Python with shared golden test vectors.
- **Intervals are half-open** `[from, to)` and carry uncertainty separately:
  `from_earliest`, `from_latest`, `to_earliest`, `to_latest`. Tiles carry four small
  integers — `y0`, `y1` (the best estimate) and `y0e`, `y1l` (earliest start, latest end)
  — so the style itself can fade features in and out at uncertain edges.
- **Centuries** are written `c+01` (AD 1–100) and `c-10` (1000–901 BC) in ids and URLs.
- **Disputed dating is data, not prose**: an event can have several `dating_view`s, each
  with a range, named proponents and sources (see ADR 0007).
- JavaScript `Date` is never used for historical time.
- Compatible with OpenHistoricalMap (`start_date`/`end_date`, decimal years) for import.

## Golden test vectors

Shared by every implementation and test. "Label" is how a historian writes it.

| Label | Astronomical | Note |
|---|---|---|
| AD 1 | 1 | |
| 1 BC | 0 | there is no year zero in labels |
| 2 BC | −1 | |
| 4 BC | −3 | death of Herod the Great (common dating) |
| 37 BC | −36 | Herod takes Jerusalem |
| 63 BC | −62 | Pompey in Jerusalem |
| 332 BC | −331 | Alexander in the Levant |
| 539 BC | −538 | Cyrus takes Babylon |
| 586 BC | −585 | fall of Jerusalem (one of two datings, with 587 BC → −586) |
| 722 BC | −721 | fall of Samaria |
| 1000 BC | −999 | |
| 1446 BC | −1445 | early Exodus dating |
| 2000 BC | −1999 | |
| AD 30 | 30 | |
| AD 70 | 70 | |

| Interval as written | Half-open, astronomical |
|---|---|
| 1st century AD (AD 1–100) | `[1, 101)` |
| 1st century BC (100–1 BC) | `[-99, 1)` |
| 10th century BC (1000–901 BC) | `[-999, -899)` |
| Herod's reign 37–4 BC, both years included | `[-36, -2)` |
| 4 BC – AD 6, both years included | `[-3, 7)` |

## Alternatives considered

- Historical years with no zero: off-by-one bugs at every subtraction.
- ISO 8601 strings with signed years: heavier, and still need parsing for filters.

## Consequences

- Property-based tests (fast-check in TS, Hypothesis in Python) guard every conversion.
- Content authors write dates in a human form (`30 AD`, `c. 1000 BC`); the validator
  converts and rejects ambiguous input.
