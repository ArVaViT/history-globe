/**
 * Where the interface leaves the map open, for a flight to put its place there. On a phone
 * the header covers the top and the card and the timeline the lower half; wider, the
 * panels cover the left, the timeline the bottom and the card the top right: beside the
 * card when there is room or the screen is short (below it there would be no map left),
 * below it otherwise. Each axis is shrunk to fit on its own, which MapLibre would otherwise
 * clamp.
 */
export function viewPadding(w = innerWidth, h = innerHeight) {
  const beside = w - 356 - 396;
  const p =
    w < 768
      ? { top: 64, bottom: h * 0.55, left: 0, right: 0 }
      : beside >= 400 || h < 600
        ? { top: 0, bottom: 140, left: 356, right: 396 }
        : { top: 360, bottom: 140, left: 356, right: 0 };
  const kx = Math.min(1, (w - 60) / (p.left + p.right || 1));
  const ky = Math.min(1, (h - 80) / (p.top + p.bottom));
  return {
    top: Math.round(p.top * ky),
    bottom: Math.round(p.bottom * ky),
    left: Math.round(p.left * kx),
    right: Math.round(p.right * kx),
  };
}
