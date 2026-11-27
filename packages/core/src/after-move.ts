// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/** The part of a MapLibre map `afterMoveEnd` listens to. */
export interface MoveEnds {
  once(type: "moveend", listener: () => void): unknown;
}

/**
 * Runs `fn` after the next "moveend", once the call that fired it has returned.
 *
 * MapLibre fires "moveend" from inside the call that interrupts a move: easeTo, flyTo and
 * fitBounds stop the move under way first, and only then start their own. A camera move
 * started right there, in the listener, is overwritten by that call's own a moment later,
 * while its first frame stays queued; that frame then drives the new move alongside it,
 * and once the camera is stopped it runs with no move left ("this._onEaseFrame is not a
 * function", maplibre-gl 6.11.2, camera.ts `_renderFrameCallback`). Waiting for the call to
 * return lets `fn` see the camera as it is: moving again if that call started a move.
 */
export function afterMoveEnd(map: MoveEnds, fn: () => void): void {
  map.once("moveend", () => {
    queueMicrotask(fn);
  });
}
