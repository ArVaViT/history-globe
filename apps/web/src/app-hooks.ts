import { YEAR_MAX, type Engine } from "@hg/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Locale } from "@hg/model";
import { chapterFocus, chapterOf } from "./chapter";
import type { LoadedData } from "./data";
import { focusOf, keyAction } from "./keys";
import type { TFunction } from "./i18n";
import { timelineEventsOf } from "./timeline-events";
import { readUrl, writeUrl, type UrlView } from "./url";
import type { Globe } from "./useGlobe";
import { NARROW } from "./view-padding";
import { readPref, writePref } from "./storage";

const PLAY_STEP = 5;
const PLAY_INTERVAL_MS = 80;

const BIBLE_ONLY_KEY = "hg:bible-only";
/**
 * The Bible alone (a setting, remembered in this browser, not in links): the events the
 * Bible tells and its places, without the ancient world around them.
 */
export function useBibleOnly(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => readPref(BIBLE_ONLY_KEY) === "1");
  const set = useCallback((next: boolean) => {
    setOn(next);
    writePref(BIBLE_ONLY_KEY, next ? "1" : null);
  }, []);
  return [on, set];
}

/**
 * Keep the URL shareable: year, place, camera, locale, layers, tour, chapter (ADR 0006), and
 * the two places measured when the distance tool shows both (`measure`, App.tsx's state, not
 * the store's: a change of it writes the link too).
 */
export function useUrlSync(
  globe: Globe | null,
  data: LoadedData | null,
  measure: readonly [string, string] | null,
  link: UrlView,
): void {
  // The tour or chapter the link opens on (started once the map is up) is the link's own
  // entry, not a step after it: that first change replaces. On any other link the first
  // choice is a step.
  const opened = useRef(Boolean(link.tour ?? link.ref));
  // The distance, read by the writer below when it runs; and the writer, for the distance's
  // own changes. Neither restarts the effect: a step under way keeps its place in history.
  const measureRef = useRef(measure);
  const saveRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!globe) return;
    let timer = 0;
    // A link's tour or chapter that is not there opens nothing: the first choice is a step.
    const v = readUrl();
    if (
      !(v.tour && data?.tours.some((t) => t.id === v.tour)) &&
      !(v.ref && data && chapterFocus(data, v.ref))
    )
      opened.current = false;
    // A chapter on the map, as the link has it: a person's places are not one.
    const chapterRef = () => chapterOf(globe.engine.store.get().focus)?.ref ?? "";
    // What the reader is looking at: a change of it is a step in the browser's history.
    const subject = () => {
      const s = globe.engine.store.get();
      return [s.selectedPlace ?? "", s.tour?.id ?? "", s.tour?.step ?? "", chapterRef()].join("|");
    };
    let last = subject();
    // Inside another site's frame the steps would fill that page's Back button: none there.
    const framed = window.self !== window.top;
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = globe.engine.store.get();
        if (!s.camera) return;
        // A person's places are not a chapter: they stay out of the link.
        const chapter = chapterOf(s.focus);
        const now = subject();
        const push = now !== last && !opened.current && !framed;
        // Spent on the link's own view, not on the camera settling before it opens.
        if (now !== last) opened.current = false;
        last = now;
        writeUrl(
          {
            year: s.year,
            camera: s.camera,
            locale: s.locale,
            ...(s.selectedPlace ? { place: s.selectedPlace } : {}),
            layers: s.layers,
            ...(s.tour ? { tour: s.tour.id, stop: s.tour.step + 1 } : {}),
            ...(chapter ? { ref: chapter.ref } : {}),
            ...(measureRef.current ? { measure: measureRef.current } : {}),
          },
          push,
        );
      }, 300);
    };
    // Back and Forward: the place and the tour of that step come back (the camera follows).
    const onPop = () => {
      const view = readUrl();
      const e = globe.engine;
      const s = e.store.get();
      // A tour the data has (a link may name one that is not there).
      if (view.tour && data?.tours.some((t) => t.id === view.tour)) {
        const step = (view.stop ?? 1) - 1;
        if (s.tour?.id !== view.tour || s.tour.step !== step) e.startTour(view.tour, step);
      } else {
        if (s.tour) e.stopTour();
        if ((view.place ?? null) !== s.selectedPlace)
          e.selectPlace(view.place ?? null, { fly: !view.camera });
        // The chapter of that step, or none.
        if ((view.ref ?? "") !== chapterRef()) {
          const focus = view.ref && data ? chapterFocus(data, view.ref) : null;
          e.focusPlaces(focus, !view.place && !view.camera);
        }
        // And the view as that step left it.
        if (view.camera) globe.renderer.flyTo(view.camera);
      }
      last = subject();
    };
    const offState = globe.engine.store.subscribe(save);
    window.addEventListener("popstate", onPop);
    saveRef.current = save;
    return () => {
      saveRef.current = () => undefined;
      offState();
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
    };
  }, [globe, data]);
  // The distance is not in the store: set or cleared, it is written from here (before the
  // first frame there is no camera yet, and nothing is written).
  useEffect(() => {
    measureRef.current = measure;
    saveRef.current();
  }, [measure]);
}

export interface MapFeed {
  /** The first frame is drawn. */
  readonly ready: boolean;
  /** The place under the pointer and where the pointer is. */
  readonly hover: { id: string; at: { x: number; y: number } } | null;
}

/** What the map reports back: ready, and the hovered place. */
export function useMapFeed(globe: Globe | null): MapFeed {
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<MapFeed["hover"]>(null);

  useEffect(() => {
    if (!globe) return;
    const offReady = globe.renderer.on("ready", () => {
      setReady(true);
    });
    const offHover = globe.renderer.on("hover", (id, at) => {
      setHover(id && at ? { id, at } : null);
    });
    return () => {
      offReady();
      offHover();
    };
  }, [globe]);

  return { ready, hover };
}

/** Play: the year runs forward five years a tick and stops at the end. */
export function usePlayback(
  engine: Engine | undefined,
  speed = 1,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !engine) return;
    const id = window.setInterval(() => {
      const y = engine.store.get().year;
      if (y >= YEAR_MAX) setPlaying(false);
      else engine.setYear(y + PLAY_STEP);
    }, PLAY_INTERVAL_MS / speed);
    return () => {
      window.clearInterval(id);
    };
  }, [playing, engine, speed]);
  return [playing, setPlaying];
}

/** The keyboard shortcuts (keys.ts decides what a key means). */
export function useKeys(
  globe: Globe | null,
  on: {
    readonly togglePlay: () => void;
    readonly focusSearch: () => void;
    /** Esc with a card the engine does not know of (a person's): true when it closed one. */
    readonly closeOwn?: () => boolean;
  },
): void {
  const { togglePlay, focusSearch, closeOwn } = on;
  useEffect(() => {
    if (!globe) return;
    const { engine } = globe;
    const onKey = (e: KeyboardEvent) => {
      // A control that used the key (the overview bar), or an open window: not the map's.
      if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const action = keyAction({
        key: e.key,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        focus: focusOf(e.target),
      });
      if (!action) return;
      if (action.kind === "year") engine.stepYear(action.delta);
      else if (action.kind === "play") {
        e.preventDefault();
        togglePlay();
      } else if (action.kind === "search") {
        e.preventDefault();
        focusSearch();
      } else if (action.kind === "stop") {
        // Only during a tour; otherwise the arrows are MapLibre's, panning the map.
        const tour = engine.store.get().tour;
        if (!tour) return;
        e.preventDefault();
        engine.goToStop(tour.step + action.delta);
      } else if (action.kind === "close") {
        if (closeOwn?.()) return;
        engine.selectPlace(null);
        engine.stopTour();
      } else engine.northUp();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [globe, togglePlay, focusSearch, closeOwn]);
}

/** A phone-wide screen, following rotation and window resizes. */
export function useNarrow(): boolean {
  return useMedia(NARROW);
}

/** A media query's answer, following rotation, resizes and a host resizing its frame. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const q = window.matchMedia(query);
      q.addEventListener("change", onChange);
      return () => {
        q.removeEventListener("change", onChange);
      };
    },
    () => window.matchMedia(query).matches,
  );
}

/**
 * The height of an element as a CSS variable on the document, so another box can sit
 * right above it (the phone card above the slider, whatever the slider's height).
 * Returns a callback ref.
 */
export function useHeightVar(name: string): (el: HTMLElement | null) => (() => void) | undefined {
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return undefined;
      const root = document.documentElement;
      const obs = new ResizeObserver(() => {
        root.style.setProperty(name, `${String(el.offsetHeight)}px`);
      });
      obs.observe(el);
      return () => {
        obs.disconnect();
        root.style.removeProperty(name);
      };
    },
    [name],
  );
}

/**
 * Marks a scrolling box with `data-scrolls` while its content is taller than it, following
 * the box and its children as they resize or come and go. The left column lets the pointer
 * through to the map while it has room to spare, and takes it again (its scrollbar too)
 * when it scrolls. Returns a callback ref.
 */
export function useScrollsMark(): (el: HTMLElement | null) => (() => void) | undefined {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return undefined;
    const mark = () => {
      el.toggleAttribute("data-scrolls", el.scrollHeight > el.clientHeight);
    };
    const sizes = new ResizeObserver(mark);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(el);
      for (const child of el.children) sizes.observe(child);
      mark();
    };
    const children = new MutationObserver(watch);
    children.observe(el, { childList: true });
    watch();
    return () => {
      sizes.disconnect();
      children.disconnect();
    };
  }, []);
}

/**
 * The dated events shown (all, or under "the Bible alone" only those it tells) and the
 * marks on the slider: the places' founding, destruction and ruin, the turning points of
 * the history and, under the Bible alone, the battles it tells.
 */
export function useTimelineMarks(
  data: LoadedData | null,
  bibleOnly: boolean,
  locale: Locale,
  t: TFunction,
) {
  const events = useMemo(
    () => (!data ? [] : bibleOnly ? data.events.filter((e) => e.ref !== undefined) : data.events),
    [data, bibleOnly],
  );
  // Founding, destruction and ruin of places, and the turning points of the history.
  // Under the Bible alone the battles it tells are marks too: before Solomon the Bible's
  // dated events are few (no disputed early dates), its battles many (Jericho, Ai, Gibeon).
  const timelineEvents = useMemo(() => {
    if (!data) return [];
    const battles = bibleOnly
      ? data.battles.flatMap((b) =>
          // Told as an event too (Lachish, 588 BC; `event` in battles.yaml): marked once, as
          // the card lists it once.
          b.ref === undefined || events.some((e) => e.id === b.event)
            ? []
            : [
                {
                  id: `battle:${b.id}`,
                  year: b.year,
                  approximate: b.approximate,
                  title: b.title,
                  place: b.place,
                  ref: b.ref,
                  sources: b.sources,
                },
              ],
        )
      : [];
    return timelineEventsOf(
      { life: data.life, byId: data.byId, events: [...events, ...battles] },
      locale,
      t,
    );
  }, [data, events, bibleOnly, locale, t]);
  return { events, timelineEvents };
}

/**
 * The sheet for a class (print.ts): while it is drawn the map is briefly resized and
 * reframed under a cover, the keys wait, and a second press waits for the first.
 */
export function usePrintSheet(globe: Globe | null, data: LoadedData | null, personLabel: string) {
  const [preparing, setPreparing] = useState(false);
  // The cover stops the mouse; the keys (a tour's arrows, the map's own) wait too, or a
  // stop would change while the sheet is drawn.
  useEffect(() => {
    if (!preparing) return;
    const hold = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", hold, true);
    return () => {
      window.removeEventListener("keydown", hold, true);
    };
  }, [preparing]);
  // Set at once, before the module loads: a second press meanwhile must not start another.
  const printing = useRef(false);
  const printForClass = async (blank = false) => {
    if (!globe || !data || printing.current) return;
    printing.current = true;
    try {
      const { printForClass: print } = await import("./print");
      await print({ globe, data, personLabel, setPreparing, blank });
    } finally {
      printing.current = false;
    }
  };
  return { preparing, printForClass };
}

/**
 * A popup that closes on a press outside `box` and on Escape. Escape is taken before the
 * page's own keys, so it closes the popup and not the card behind it, and gives the focus
 * back to `button`.
 */
export function useDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
  box: RefObject<HTMLElement | null>,
  button: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, setOpen, box, button]);
}

/**
 * The map's own controls leave their corners: the zoom and compass go into the player
 * (`scaleSlot`), the scale and the sources' (i) onto the map just above it (`mapSlot`; in the
 * player they crowded its buttons). Folded, the player is shorter and they follow it down.
 */
export function useMapControlSlots(
  container: RefObject<HTMLElement | null>,
  globe: Globe | null,
  scaleSlot: HTMLElement | null,
  mapSlot: HTMLElement | null,
): void {
  useEffect(() => {
    const root = container.current;
    const parts = [
      [".maplibregl-ctrl-attrib", ".maplibregl-ctrl-bottom-right", mapSlot],
      [".maplibregl-ctrl-scale", ".maplibregl-ctrl-bottom-left", mapSlot],
      [
        ".maplibregl-ctrl-bottom-right .maplibregl-ctrl-group",
        ".maplibregl-ctrl-bottom-right",
        scaleSlot,
      ],
    ] as const;
    const moved = parts.flatMap(([what, home, slot]) => {
      const el = root?.querySelector(what);
      const corner = root?.querySelector(home);
      return el && corner && slot ? [{ el, corner, slot }] : [];
    });
    for (const { el, slot } of moved) slot.append(el);
    return () => {
      for (const { el, corner } of moved) corner.append(el);
    };
  }, [container, globe, scaleSlot, mapSlot]);
}
