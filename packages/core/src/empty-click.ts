// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * Whether a click that hit no place is a click on the map itself (the renderer's `pickNone`)
 * and not the tail of something else. MapLibre fires `click` on a release after a drag that a
 * flight cut short, on a press that stopped a moving camera, and twice before a `dblclick`
 * zooms: none of these is a reader pointing at empty ground. So a press made while the camera
 * moved, or followed by any movement, gives nothing, and an empty click is told only after
 * the time a double-click would take, if no second click, zoom or movement came first.
 */
export interface EmptyClicks {
  /** A press on the map; `moving`: the camera was moving at that moment. */
  down(moving: boolean): void;
  /** The camera moved (a drag, a flight, a zoom). */
  moved(): void;
  /** The reader started dragging the map. */
  dragged(): void;
  /**
   * Whether a click is a click at all: not the release of a drag. MapLibre still fires one when
   * a flight cuts the drag short; it must neither pick the place under the pointer nor clear
   * the selection.
   */
  isClick(): boolean;
  /** A click; `hit`: it picked a place or a battle's mark. */
  click(hit: boolean): void;
  /** The second click of a double-click. */
  dblclick(): void;
  /** Drops a click still waiting. */
  cancel(): void;
}

export function emptyClicks(
  emit: () => void,
  delayMs = 300,
  timers: {
    set: (f: () => void, ms: number) => unknown;
    clear: (t: unknown) => void;
  } = {
    set: (f, ms) => setTimeout(f, ms),
    clear: (t) => {
      clearTimeout(t as ReturnType<typeof setTimeout>);
    },
  },
): EmptyClicks {
  let moved = false;
  let drag = false;
  let waiting: unknown;
  const cancel = () => {
    if (waiting !== undefined) timers.clear(waiting);
    waiting = undefined;
  };
  return {
    down: (moving) => {
      moved = moving;
      drag = false;
    },
    dragged: () => {
      drag = true;
      moved = true;
      cancel();
    },
    isClick: () => !drag,
    moved: () => {
      moved = true;
      cancel();
    },
    click: (hit) => {
      cancel();
      if (hit || moved) return;
      waiting = timers.set(() => {
        waiting = undefined;
        emit();
      }, delayMs);
    },
    dblclick: cancel,
    cancel,
  };
}
