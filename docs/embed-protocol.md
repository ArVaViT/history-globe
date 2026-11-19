# Embed protocol v1

The contract between the globe (`/embed/v1`) and a host page, such as a learning platform or
an LMS (ADR 0006). v1 is published and changes only by additions; a breaking change is
`/embed/v2`. Code: `apps/web/src/embed.ts`, `apps/web/src/embed-protocol.ts`.

`/embed/v1?…` redirects to `/?embed=1&…`: the app with the map and the place card, without
the left column. At the top, the chapter of `ref` with its places in reading order and a
"History Globe ↗" link to the same view in a new tab; at the bottom, the year, folded, which
opens the slider. With `ui=map` the map is alone, for a host with its own search and place
box: no place card, no chapter bar, the year folded to its pill at any frame size, the link
kept (credit is required). The selected place wears a pulsing ring (a still one for a reader
who asks for less motion; none with the places layer off).

Not yet: `theme`, and an origin allowlist (needed once a host sends anything sensitive).

## URL

```text
https://<globe-host>/embed/v1?year=30&place=af2161c&locale=ru
```

| Parameter | Type                             | Meaning                                                                  |
| --------- | -------------------------------- | ------------------------------------------------------------------------ |
| `year`    | integer, astronomical (ADR 0003) | initial year                                                             |
| `place`   | place id (below)                 | place to select and fly to (Capernaum: `af2161c`)                        |
| `camera`  | `lon,lat,zoom,pitch,bearing`     | the map opens here; with `place`, the place is selected without a flight |
| `hide`    | comma list                       | listed layers off, the rest on (`relief,battles`)                        |
| `layers`  | comma list (older links)         | listed layers on, the rest off; a layer added later on                   |
| `ref`     | OSIS chapter, range or book      | the chapter's places (`Acts.16`)                                         |
| `tour`    | tour id                          | start a guided tour                                                      |
| `stop`    | 2, 3, … (with `tour`)            | open the tour at that stop                                               |
| `measure` | two place ids, comma-separated   | the distance line between them (the figure is in the tools)              |
| `locale`  | one of the 21 site languages     | UI and names (`LOCALES`, `packages/model/src/locales.ts`)                |
| `ui`      | `map`                            | map only: no card, no chapter bar, the year folded, the ring             |

Layers: `borders`, `places`, `relief`, `routes`, `roads`, `battles` (`ancient` in an older
link is passed over: the ancient world's places are places, ADR 0018).

**Place ids.** A place of the Bible: OpenBible's id, `a` + 6 hex digits (`af2161c`). A place
of the ancient world the Bible does not name (ADR 0018): its Pleiades number (`678146`,
Gamla; `678387`, Sepphoris) or, without one, its Wikidata item (Constantinople is `Q16869`). Both go out in
`view.place` and `hg:place-clicked`, and both are taken by `hg:set-view`; a host keyed on
OpenBible tests the form. 54 of OpenBible's 1342 records are not on the map (21 left out for
want of a point that may be published, 33 with no point; `manifest.json` stats); their ids
are ignored.

## Messages

All messages are plain objects with `type` and `v: 1`. Outgoing messages carry only the view
(or a place or a verse), nothing about the reader, and are posted to the parent with target
`"*"`, so any host may listen. Incoming messages are taken only from the frame's parent
(`e.source === window.parent`) and only with `v: 1`; there is no origin allowlist yet.

Globe → host:

| `type`             | Payload                       | When                                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hg:ready`         | `{ view }`                    | the map and its data are loaded                                                                                                                                                                                                                                             |
| `hg:view-changed`  | `{ view }`                    | the view changed and settled (400 ms debounce), by the reader, a camera move or the host's own `hg:set-view`; only a view that differs from the last one sent. A flight to a newly selected place gives two: the new place with the camera left, then the camera at the end |
| `hg:place-clicked` | `{ place }`                   | a place clicked on the map, the selected one again too (sent at once, before the `hg:view-changed` it causes)                                                                                                                                                               |
| `hg:verse-clicked` | `{ osis }` e.g. `"Acts.13.4"` | a verse opened in the place card (never with `ui=map`)                                                                                                                                                                                                                      |
| `hg:error`         | `{ code, message }`           | `code`: `data` or `map` (WebGL or the protocol's own code)                                                                                                                                                                                                                  |

Host → globe (send after `hg:ready`: earlier messages are not heard):

| `type`          | Payload              | Effect                                                                                                         |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `hg:set-view`   | `{ view }` (partial) | year, chapter (`ref`), place, layers, camera; with `tour`, the tour starts (at `stop`) and the rest is ignored |
| `hg:set-locale` | `{ locale }`         | switch language                                                                                                |

`hg:set-view` details: `place: null` clears the selection and ends a running tour (as Escape
does); a `place` already selected is flown to again unless `camera` is given too (a host that
echoes `hg:view-changed` back, camera included, keeps the reader's camera; one that answers
with `{place}` alone flies the map back to the place); unknown place ids, tours and layers
are ignored; a camera already shown is not flown to again.

`view` is `EmbedView` (`apps/web/src/embed.ts`): `year`, `locale`, `layers` and, when set,
`place`, `tour`, `stop` (from 1), `ref` (a chapter, not a person's places) and `camera`
(`{ center: [lon, lat], zoom, pitch, bearing }`, rounded). No `place` means nothing is
selected.

With `ui=map`: a tour runs on the map (route, stops, year) without its card, driven by the
host's `hg:set-view`; `measure` draws its line without the figure; `hg:verse-clicked` is not
sent (no card); a click on the map away from any place clears the place selection and leaves a
running tour going (only in this mode: elsewhere the card has its own close button); a
double-click, a drag's release and a press that stopped the camera clear nothing.

## Changelog

- 2026-10-01: v1 published, with the parameters above and the messages `hg:ready`,
  `hg:view-changed`, `hg:verse-clicked`, `hg:error`, `hg:set-view` and `hg:set-locale`.
- 2026-10-02: the folded year at the bottom of the frame.
- 2026-11-16: `ui=map`; `hg:place-clicked`; `place: null` in `hg:set-view`. A place already
  selected is now flown to again: before, `hg:set-view {place}` for the selected place did
  nothing; now, without `camera`, it flies back to the place, so a host must not answer
  `hg:view-changed` with `{place}` alone.
