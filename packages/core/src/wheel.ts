/**
 * What a wheel event means on the globe. On a Mac trackpad two fingers moving pan the
 * map, and a pinch arrives as a wheel event with ctrlKey set: that zooms. A mouse wheel
 * (whole lines, or big vertical steps and no sideways part) zooms, as everywhere.
 */
export interface WheelLike {
  readonly deltaX: number;
  readonly deltaY: number;
  /** 0 pixels, 1 lines, 2 pages (WheelEvent.deltaMode). */
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
}

export type WheelIntent =
  | { readonly kind: "pan"; readonly dx: number; readonly dy: number }
  | { readonly kind: "zoom"; readonly dz: number };

const LINE = 40; // pixels per line when the browser reports lines

export function wheelIntent(e: WheelLike): WheelIntent {
  const scale = e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? 800 : 1;
  const dx = e.deltaX * scale;
  const dy = e.deltaY * scale;
  // Pinch: small steps, zoom quickly enough to follow the fingers.
  if (e.ctrlKey) return { kind: "zoom", dz: -dy / 100 };
  const mouseWheel = e.deltaMode !== 0 || (dx === 0 && Math.abs(dy) >= 50);
  if (mouseWheel) return { kind: "zoom", dz: -dy / 450 };
  return { kind: "pan", dx, dy };
}
