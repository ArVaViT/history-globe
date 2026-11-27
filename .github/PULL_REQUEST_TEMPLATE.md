## What and why

## Checks

- [ ] `pnpm gate` passes (and `pnpm gate:full` if the pipeline or the data it builds changed)
- [ ] New or changed behaviour has tests
- [ ] Rendering or embed changes: `pnpm e2e` and `pnpm e2e:a11y` pass
- [ ] UI changes: screenshots at 1440×900 and 390×844 attached
- [ ] Content changes carry citations and are in every language
- [ ] No ADR contradicted, or a new ADR supersedes it
- [ ] Commits signed off (`git commit -s`, DCO); the contribution is licensed as `LICENSING.md`, part 8, says
