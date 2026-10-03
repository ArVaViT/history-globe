# Embed protocol v1 (draft)

**Implemented (2026-10-01):** `/embed/v1?…` (a redirect to `/?embed=1&…`; the app with
the map and the card, no column; at the top the chapter of `ref` with the list of its places
in reading order, and a "History Globe ↗" link to the same view in a new tab; at the bottom
the year, folded, which opens the slider (2026-10-02)); `year`, `place`, `tour`, `stop`, `locale` and also `ref` (a chapter,
`ref=Acts.16`); messages `hg:ready` and `hg:view-changed` (`view`: year, locale, place,
tour, stop, ref, camera, layers), `hg:verse-clicked` (`osis`, when a verse is opened in the place
card), `hg:error` (`code`: data or map, `message`), `hg:set-view` (the same fields) and `hg:set-locale`. Outgoing messages
carry only the view (or the verse) and go to any parent; incoming ones are taken only from the parent
frame. **Not yet:** `theme`, an origin allowlist (needed once a host sends anything sensitive). Code:
`apps/web/src/embed.ts`.

The contract between the globe (`/embed/v1`) and a host page such as Equip
(ADR 0006). Draft until the first release; after that, only additive changes within v1.

## URL

```text
https://<globe-host>/embed/v1?year=30&place=af2161c&locale=ru&theme=dark
```

| Parameter | Type                              | Meaning                                                |
| --------- | --------------------------------- | ------------------------------------------------------ |
| `year`    | integer, astronomical (ADR 0003)  | initial year                                           |
| `place`   | place id (`a` + 6 hex, OpenBible) | place to focus and open (Capernaum: `af2161c`)         |
| `camera`  | `lon,lat,zoom,pitch,bearing`      | overrides the default camera for `place`               |
| `hide`    | comma list                        | listed layers off, the rest on (`relief,ancient`)      |
| `layers`  | comma list (older links)          | listed layers on, the rest off; a layer added later on |
| `tour`    | tour id                           | start a guided tour                                    |
| `stop`    | 2, 3, … (with `tour`)             | open the tour at that stop                             |
| `locale`  | `en` \| `ru` (`uk`, `de` later)   | UI and names                                           |
| `theme`   | `light` \| `dark`                 | colour scheme                                          |

## Messages

All messages are plain objects with `type` and `v: 1`. The globe only accepts messages
from origins allowed for the embed, and only posts to the parent origin.

Globe → host:

| `type`             | Payload                       | When                                      |
| ------------------ | ----------------------------- | ----------------------------------------- |
| `hg:ready`         | `{ view }`                    | first frame rendered                      |
| `hg:view-changed`  | `{ view }`                    | year, place or camera settled (debounced) |
| `hg:verse-clicked` | `{ osis }` e.g. `"Acts.13.4"` | reader clicked a verse reference          |
| `hg:error`         | `{ code, message }`           | WebGL failed, data failed to load         |

Host → globe:

| `type`          | Payload              | Effect                        |
| --------------- | -------------------- | ----------------------------- |
| `hg:set-view`   | `{ view }` (partial) | move to year / place / camera |
| `hg:set-locale` | `{ locale }`         | switch language               |
| `hg:set-theme`  | `{ theme }`          | switch colour scheme          |

`view` is the `GlobeView` object encoded by the shared codec in `packages/model`.
