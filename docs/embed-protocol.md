# Embed protocol v1 (draft)

The contract between the globe (`/embed/v1`) and a host page such as Equip
(ADR 0006). Draft until the first release; after that, only additive changes within v1.

## URL

```text
https://<globe-host>/embed/v1?year=30&place=af2161c&locale=ru&theme=dark
```

| Parameter | Type                              | Meaning                                        |
| --------- | --------------------------------- | ---------------------------------------------- |
| `year`    | integer, astronomical (ADR 0003)  | initial year                                   |
| `place`   | place id (`a` + 6 hex, OpenBible) | place to focus and open (Capernaum: `af2161c`) |
| `camera`  | `lon,lat,zoom,pitch,bearing`      | overrides the default camera for `place`       |
| `layers`  | comma list                        | e.g. `borders,places,routes`                   |
| `tour`    | tour id                           | start a guided tour                            |
| `locale`  | `en` \| `ru` (`uk`, `de` later)   | UI and names                                   |
| `theme`   | `light` \| `dark`                 | colour scheme                                  |

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
