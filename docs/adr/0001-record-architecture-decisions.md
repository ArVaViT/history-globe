# 0001. Record architecture decisions

- Status: accepted
- Date: 2026-09-28

## Context

The project is built by one developer together with AI coding agents. Decisions
made in a chat disappear; agents in a later session cannot see why something is
the way it is and will "fix" it back.

## Decision

Every decision that is expensive to reverse (framework, data model, licensing of
a data source, hosting, public API) gets a short ADR in `docs/adr/`, numbered,
never edited after acceptance except to mark it superseded.

## Alternatives considered

- Notes in the README only: they drift and lose the "why".
- Decisions in issue threads: not versioned with the code, invisible to agents.

## Consequences

Agents must read `docs/adr/` before changing architecture, and a PR that changes
a recorded decision must add a new ADR that supersedes the old one.
