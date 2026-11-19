import type { RefObject } from "react";

/**
 * Move the focus to a control on the next frame: a press that closes or swaps what held the
 * focus leaves the control it goes to drawn only then.
 */
export function focusNextFrame(ref: RefObject<HTMLElement | null>): void {
  requestAnimationFrame(() => {
    ref.current?.focus();
  });
}
