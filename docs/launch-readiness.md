# Launch readiness

**Status (2026-10-25):** History Globe has been live at historyglobe.app since 2026-10-03.
This page is kept as the record of the launch review. Still open from it: the terrain is
still served from Mapterhorn's servers (section 2, owner); the questions in
`docs/legal-questions.md` wait for a lawyer before any commercial use (owner); errors are
reported through a GitHub issue or by email to historyglobe.vadym@gmail.com (section 5).
The rest below is as it was written, with the About page since replaced by `/docs/` (the
sources, privacy and methodology pages).

What had to be true before History Globe went live on its own domain, so that rights, data,
storage and AI raise as few problems as possible. Written 2026-10-01 from the licence
review of ADR 0008, `docs/legal-questions.md`, `docs/ATTRIBUTIONS.md` and a check of
every source against its terms. Status: **done** (in the code), **todo** (before
launch), **owner** (needs the owner's decision or account).

## 1. Rights and attribution

| Source                                                 | Terms                                          | Where we satisfy them                                                                 | Status                                    |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| OpenBible.info Geocoding Data                          | CC BY 4.0                                      | Map attribution ("modified"); About: link to the repository, licence, what we changed | done                                      |
| Cliopatria (Seshat) v0.2.0                             | CC BY 4.0                                      | Map attribution ("modified"); About: authors, version, DOI                            | done                                      |
| Copernicus WorldDEM-30 (via Mapterhorn)                | Copernicus licence 6(a)–(e)                    | Full copyright line in the map attribution; disclaimer 6(c) on About                  | done                                      |
| ASTER GDEM (Israel 10 m, 4cast)                        | courtesy line                                  | About                                                                                 | done; 4cast's own terms: legal question 3 |
| Cyprus DTM 2019                                        | CC BY 4.0                                      | About                                                                                 | done                                      |
| Natural Earth, Wikidata                                | public domain, CC0                             | Map attribution, About (not required)                                                 | done                                      |
| Synodal text, KJV, WEB                                 | public domain (KJV: Crown copyright in the UK) | About                                                                                 | done; UK: legal question 4                |
| React, scheduler (MIT); Golos Text, Literata (OFL 1.1) | keep notices                                   | `licenses/third-party.txt`, linked from About                                         | done                                      |
| MapLibre GL JS (BSD-3)                                 | keep notice                                    | `vendor/maplibre-gl-<v>/LICENSE.txt`                                                  | done                                      |
| Lucide / Feather icons (ISC, MIT)                      | keep notice                                    | `licenses/lucide-icons.txt`                                                           | done                                      |
| Photos, Wikimedia Commons (PD, CC0, CC BY)             | credit, licence, link                          | under each photo in the card; the build refuses share-alike                           | done (111 places); CC BY-SA: owner        |

- **No share-alike data** ships (ADR 0008): Theographic, OSM-derived points and other
  CC BY-SA or ODbL sources are kept out; the pipeline drops OpenBible points copied from
  OpenStreetMap or Google.
- `docs/ATTRIBUTIONS.md` lists what the release contains (trimmed 2026-10-01). **done**:
  it points to Mapterhorn's list of terrain sources, which CC BY 4.0 allows.
- **owner**: the ten questions in `docs/legal-questions.md` go to a lawyer before any
  commercial use; none blocks a free launch.

## 2. Hosting and storage

- **Static site, no server.** The app, its data and the terrain are files; nothing is
  computed per visitor. Since 2026-10-02 the plan is **Vercel** for the site (the owner's
  choice; `apps/web/vercel.json`, deploying a release built ahead with
  `vercel build` and `vercel deploy --prebuilt`) and a **Supabase** database holding the same content for an
  API and readers' corrections later (ADR 0012, schema in `db/`). The site still reads
  only static files: no accounts, no backend to keep running or to breach. Cloudflare R2
  remains the plan for the terrain extract below (ADR 0005), or Supabase Storage.
- **Terrain off Mapterhorn's servers (todo, owner).** Today the relief streams from
  `tiles.mapterhorn.com`; its author asks heavy users to download the PMTiles, and the
  service logs visitors' IP addresses for 30 days. Before launch: extract our region
  (`pmtiles extract` of the Mapterhorn planet file, bbox 5,12,70,48, z0–10 and the core
  Levant to z11), put it on R2 and point `TERRAIN.tiles` in `apps/web/src/useGlobe.ts`
  at it. Needs the owner's Cloudflare (or Supabase Storage) account. Measure the extract's
  size before choosing the plan; R2 has no egress fees.
- **Data size.** Measured 2026-10-01 on the production build, phone viewport: our files
  1.80 MB transferred (app, data, fonts), the relief tiles 1.54 MB more. The map is ready in
  0.7 s on a fast line and 3.4 s on a 9 Mbit/s 4G profile. The borders of 3500 BC – AD 500
  are the largest part of the data (972 → 812 kB gzip on 2026-10-02 by writing them at
  three decimals); next steps if it matters: simplify polity geometry further, or move
  the borders to PMTiles as ADR 0005 plans.
- **Islands at close zoom (done 2026-10-01).** The sea is Natural Earth 1:10m inside the
  map's region (cut along its edge in the pipeline, no new library) and 1:50m outside;
  shores come from the uncut rings, simplified to ~300 m. Cost: +128 kB gzip of water.
  Some islands still sit in square Cliopatria border boxes: that is the polity data.
- **Copies of the content.** The content lives in git (GitHub); ADR 0007 asks for a
  periodic mirror to the owner's archive disk. The data release (`apps/web/public/data`)
  is rebuilt from git by `pnpm data`, so it needs no backup of its own.
- **Domain.** Any registrar, pointed at Vercel (and at R2 for the terrain, if used).
  Turn on HTTPS only and HSTS. No email on the domain is needed to launch.

## 3. Privacy

- The app sets **no cookies** and has **no accounts**. Visits are counted by Vercel Web
  Analytics (cookieless, no IP stored; loaded only on historyglobe.app in a production
  build, `apps/web/src/visits.ts`; the static pages carry it when built with SITE_URL);
  it is switched on in the Vercel project's Analytics tab. It keeps only
  interface choices in the browser's `localStorage` (panels open, the chevron's panel).
- Third parties a visitor's browser talks to: the terrain host (Mapterhorn today, our
  R2 after the move above) and BibleGateway or Google Maps only when a link is clicked.
  Fonts and place photos are self-hosted.
- The About page says so (done). With the terrain on our own R2, its Mapterhorn
  IP-logging line goes away.
- What is kept and where is the public page `docs/privacy.html` (`content/docs/*/privacy.html`);
  a change to any of the above changes that page and its date.

## 4. AI

- **How the content is made.** Tours, events, Russian names and articles are drafted
  with AI help under the owner's direction and checked against the sources in
  `docs/content-guide.md` by independent fact-checking passes; every claim cites its
  source. The About page says so (done): readers and reviewers trust a
  project that is open about it, and the review status shown on each article
  ("checked" vs "reviewed by a scholar") keeps the line honest.
- **Quotations come from public-domain texts only** (Synodal, KJV), never from a
  copyrighted translation, and are verified word for word by the fact-check passes.
- **AI crawlers (owner, 2026-10-17).** A public, free educational site gains from being
  cited by AI assistants, and the owner's line is: the content reaches readers through the
  site and through assistants that cite it, and it is not training data. `robots.txt` names
  the AI crawlers explicitly in two groups: answer engines that cite their sources
  (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, …) are
  allowed; crawlers that gather training text (GPTBot, ClaudeBot, CCBot, Google-Extended,
  Applebot-Extended, meta-externalagent, Amazonbot, Bytespider, …) are disallowed. The
  `Content-Signal: search=yes, ai-input=yes, ai-train=no` line (Cloudflare's content
  signals) says the same to crawlers that read it, and with the `tdm-reservation` header
  (`vercel.json`) is the machine-readable form of the text-and-data-mining reservation in
  `LICENSE` (ADR 0016). Google's search and Bing are not affected: Googlebot and bingbot
  are not in either group. A crawler that ignores `robots.txt` is not stopped by it; the
  firewall is the next step (ADR 0016, consequences). Since 2026-10-19 such a crawler shows
  itself: every page links, invisibly, to `/export/`, which `robots.txt` disallows, and a
  page of the site that runs from another host asks the site for `/origin/<host>`; the
  firewall's log rules list both (ADR 0017, addendum).
- **Agents (done 2026-10-14).** `llms.txt` lists every language's pages, docs and the API;
  the place pages carry `Place` structured data with their address and the map. In a
  browser with WebMCP (Chrome's origin trial), the map registers two read-only tools,
  `search_places` and `get_place` (`apps/web/src/agent-tools.ts`), loaded only there. A
  trial token, when the owner registers one, is given to the build as
  `WEBMCP_ORIGIN_TRIAL`; none is in the code.
- **No AI chat in the product** (competitor review, 2026-10-01): every newcomer has one
  and none is better for it; it would also add cost, moderation and accuracy risk.

## 5. Accuracy and corrections

- "Нашли ошибку?" in the place card opens a GitHub issue with the place named (done);
  later a form or an address on the domain, for readers without a GitHub account.
- Independent reviewers credited on the About page and on what they reviewed; workflow
  and candidates in the owner's notes of 2026-10-01.

## 6. Checklist on the day

1. `pnpm gate:full` green; production smoke test (`vite preview`, the in-view list fills).
2. Terrain on our R2; attribution line updated if the sources change.
3. About: the privacy line matches where the terrain is served from.
4. Build with the domain: `SITE_URL=https://<domain> pnpm content && pnpm build`. The
   place and tour pages (`scripts/build-pages.ts`, 2 × 1231 places and 2 × 46 tours)
   then carry canonical and hreflang links and Open Graph tags (`og.jpg`), and
   `sitemap.xml` is written; add `Sitemap: https://<domain>/sitemap.xml` to `robots.txt`
   (with the owner's AI-crawler choice applied). Submit the sitemap in Google Search
   Console and Yandex Webmaster. IndexNow (Bing, Yandex, Seznam, Naver) needs no account:
   the key file is in `public/`, and `.github/workflows/indexnow.yml` sends the pages whose
   hash in `page-hashes.json` changed, daily or by hand (`gh workflow run indexnow.yml`).
5. HTTPS, HSTS; `404.html` is in place (absolute links: the site must sit at the domain root, so the build's `BASE_URL` stays `/`).
6. Tell the data sources (OpenBible, Cliopatria, Mapterhorn) the project is live, with
   the link and how we credit them.
