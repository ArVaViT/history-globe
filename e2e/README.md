# Browser checks

Two scripts drive the running app in Chromium:

- `pnpm e2e` (`flows.mjs`): the main ways through the app. That covers search, a place card and its verses, keys, layers, tours, events, the overview, people, the language switch and bad links. It prints one line per step and fails on any step or page error.
- `pnpm e2e:a11y` (`a11y.mjs`): axe-core over every state listed in `a11y.mjs`. It fails on any violation.
- `pnpm e2e:copies` (`copies.mjs`): the beacon and the honeypot (ADR 0017, addendum) against a build served by `vite preview`: silent on the site, its embed and a preview; a copy on another host, played by a route, sends `/origin/<host>` and shows the original's address. Needs no network.

They are not part of `pnpm gate`. Playwright is not a dependency of the repo: its browsers are a large download, and ADR 0010 leaves the browser tests for later. So the scripts take Playwright from wherever it is installed:

```sh
pnpm dev                                    # in another terminal
HG_URL=http://localhost:5173/ PLAYWRIGHT=~/path/to/a/project/with/playwright pnpm e2e
```

- `CHROMIUM=<path>` picks the browser; Playwright's own is the default.
- The steps read the Russian interface, so they open the app with `locale=ru`.
- The a11y check loads axe-core from cdnjs, so it needs the network.
