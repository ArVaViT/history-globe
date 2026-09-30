/**
 * Where the interface leaves the map open, for a flight to put its place there. On a phone
 * the header covers the top and the card and the timeline the lower half; wider, the
 * panels cover the left, the timeline the bottom and the card the top right: beside the
 * card when there is room, below it when not. Shrunk to fit a small screen (a phone on
 * its side), which MapLibre would otherwise clamp.
 */
export function viewPadding(w = innerWidth, h = innerHeight) {
  const p =
    w < 768
      ? { top: 64, bottom: h * 0.55, left: 0, right: 0 }
      : w - 356 - 396 >= 400
        ? { top: 0, bottom: 140, left: 356, right: 396 }
        : { top: 360, bottom: 140, left: 356, right: 0 };
  const k = Math.min(1, (w - 80) / (p.left + p.right || 1), (h - 80) / (p.top + p.bottom));
  return {
    top: Math.round(p.top * k),
    bottom: Math.round(p.bottom * k),
    left: Math.round(p.left * k),
    right: Math.round(p.right * k),
  };
}
