/**
 * What a wheel event means on the globe. On a Mac trackpad two fingers moving pan the
 * map, and a pinch arrives as a wheel event with ctrlKey set: that zooms. A mouse wheel
 * zooms, as everywhere.
 *
 * The kind is decided on the first event of a gesture and kept until the wheel rests
 * (GESTURE_GAP_MS): momentum events of a fast swipe are big and axis-aligned, and read
 * one by one they would look like a mouse wheel and turn a pan into a zoom.
 */
export interface WheelLike {
  readonly deltaX: number;
  readonly deltaY: number;
  /** 0 pixels, 1 lines, 2 pages (WheelEvent.deltaMode). */
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey?: boolean;
}

export type WheelIntent =
  | { readonly kind: "pan"; readonly dx: number; readonly dy: number }
  | { readonly kind: "zoom"; readonly dz: number };

const LINE = 40; // pixels per line when the browser reports lines
const GESTURE_GAP_MS = 250;
/** Safari and Firefox on macOS send one mouse-wheel notch as a multiple of this. */
const MAC_NOTCH = 4.000244140625;

type Kind = "pan" | "zoom" | "pinch";

function firstKind(e: WheelLike, dx: number, dy: number): Kind {
  if (e.ctrlKey) return "pinch";
  if (e.deltaMode !== 0) return "zoom";
  if (dy !== 0 && Math.abs(dy % MAC_NOTCH) < 1e-6) return "zoom";
  // Chrome and Edge: a notch is 100 or 120 px straight down; a trackpad starts small.
  if (dx === 0 && Math.abs(dy) >= 50) return "zoom";
  return "pan";
}

/** Keeps the kind of the current gesture across its events. */
export class WheelClassifier {
  private kind: Kind | null = null;
  private last = -Infinity;

  classify(e: WheelLike, now: number): WheelIntent {
    const scale = e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? 800 : 1;
    let dx = e.deltaX * scale;
    let dy = e.deltaY * scale;
    // Shift + wheel, and horizontal wheels in line mode: sideways pan.
    if (e.deltaMode !== 0 && (e.shiftKey || (dy === 0 && dx !== 0))) {
      if (e.shiftKey && dx === 0) [dx, dy] = [dy, 0];
      this.last = now;
      return { kind: "pan", dx, dy };
    }
    if (now - this.last > GESTURE_GAP_MS || e.ctrlKey !== (this.kind === "pinch")) {
      this.kind = firstKind(e, dx, dy);
    }
    this.last = now;
    if (this.kind === "pinch") return { kind: "zoom", dz: -dy / 100 };
    if (this.kind === "zoom") return { kind: "zoom", dz: -dy / 450 };
    return { kind: "pan", dx, dy };
  }
}

/** One event on its own, as the first of a gesture. */
export function wheelIntent(e: WheelLike): WheelIntent {
  return new WheelClassifier().classify(e, 0);
}
