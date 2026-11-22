import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

/**
 * Move the focus to a control on the next frame: a press that closes or swaps what held the
 * focus leaves the control it goes to drawn only then.
 */
export function focusNextFrame(ref: RefObject<HTMLElement | null>): void {
  requestAnimationFrame(() => {
    ref.current?.focus();
  });
}

/** The id of the app's one polite live region (App.tsx). */
export const LIVE_ID = "hg-live";

/**
 * Says something to a screen reader through the live region, without moving the focus.
 * Emptied first and filled on the next frame, so the same words twice are read twice.
 */
export function announce(text: string): void {
  const el = document.getElementById(LIVE_ID);
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = text;
  });
}

/** Shown on the screen: an element that is in the page and not hidden. */
const shown = (el: HTMLElement) => el.isConnected && el.getClientRects().length > 0;

/** How long a card's title may take to arrive (its code loads on the first open). */
const TITLE_WAIT_MS = 3000;

interface Opener {
  readonly el: HTMLElement;
  /** Where the focus goes back to when `el` has gone (the search field, a closed overview). */
  readonly home: RefObject<HTMLElement | null> | null;
  /** A press on the map: the card opens beside it and the focus stays where it is. */
  readonly map: boolean;
}

/**
 * The focus of the card beside the map (a place, a tour's stop, a person). Opened by a
 * control (a search result, a tour in the overview), the card takes the focus on its title,
 * and closed, it gives it back to that control, or to the `home` of a control that has gone
 * meanwhile (`home(null)`: where it goes when nothing opened the card, as with a link).
 * Opened by a press on the map, the focus stays on the map. Either way the live region says
 * what opened (`said`). A card swapped for another (a place's neighbour, a stop's place)
 * passes the focus to the new title when the old one held it.
 *
 * `key` names what the card shows (null: no card); `card` is the card's box.
 */
export function useCardFocus(
  key: string | null,
  said: string,
  card: RefObject<HTMLElement | null>,
  home: (el: HTMLElement | null) => RefObject<HTMLElement | null> | null,
): void {
  const last = useRef<Opener | null>(null);
  const opener = useRef<Opener | null>(null);
  const was = useRef<string | null>(null);
  // The last control focused outside the card: the one that opens it.
  const focused = useEffectEvent((el: HTMLElement) => {
    if (card.current?.contains(el)) return;
    last.current = { el, home: home(el), map: el.classList.contains("maplibregl-canvas") };
  });
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) focused(e.target);
    };
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
  /** True when the focus should go to the new card's title. */
  const changed = useEffectEvent((now: string | null): boolean => {
    const before = was.current;
    was.current = now;
    if (now === before) return false;
    const active = document.activeElement;
    const lost = !active || active === document.body;
    const inCard = active instanceof Node && Boolean(card.current?.contains(active));
    if (now === null) {
      const o = opener.current;
      opener.current = null;
      // Only a focus the closing took away is given back: not one the reader moved on.
      if (!lost && !inCard) return false;
      const to = o ? (shown(o.el) ? o.el : o.home?.current) : home(null)?.current;
      to?.focus();
      return false;
    }
    if (said) announce(said);
    // Swapped from inside the card (its focus went with the old card): the opener stays.
    if (before !== null && (lost || inCard)) return true;
    opener.current = last.current;
    return opener.current !== null && !opener.current.map;
  });
  useEffect(() => {
    if (!changed(key)) return;
    // The title arrives with the card's code: looked for frame by frame until it is there.
    const end = performance.now() + TITLE_WAIT_MS;
    let frame = requestAnimationFrame(function find() {
      const title = card.current?.querySelector<HTMLElement>("h2");
      if (title) {
        if (!title.hasAttribute("tabindex")) title.tabIndex = -1;
        title.focus({ preventScroll: true });
      } else if (performance.now() < end) frame = requestAnimationFrame(find);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [key, card]);
}
