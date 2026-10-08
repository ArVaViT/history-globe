/**
 * Where the interface leaves the map open, for a flight to put its place there. On a phone
 * the header covers the top and the card and the timeline the lower half; wider, the
 * panels cover the left, the timeline the bottom and the card the top right: beside the
 * card when there is room or the screen is short (below it there would be no map left),
 * below it otherwise. Each axis is shrunk to fit on its own, which MapLibre would otherwise
 * clamp.
 */
export function viewPadding(
  w = innerWidth,
  h = innerHeight,
  embed = false,
  timeline = 124,
  card = true,
  chip = false,
  panel = true,
) {
  // Embedded, there is no column on the left, the chapter's chip sits at the top and the
  // timeline is folded to a line until opened (its height is measured); with no card
  // open, the frame is the map's.
  // The column is 360 px at 16 px; the card 420 px at the right edge;
  // the full-width timeline about 175 px tall.
  // No panel open on the left (the overview, a tool, the search), the map has that room too.
  const column = embed || !panel ? 0 : 376;
  const top = embed ? 56 : 0;
  const bottom = embed ? timeline + 24 : 190;
  // Embedded, the card keeps 60 px of the right edge for the map's zoom buttons.
  const cardEdge = embed ? 492 : 452;
  const beside = w - column - cardEdge;
  const p =
    embed && !card
      ? { top, bottom, left: 0, right: 0 }
      : w < 768 && !card
        ? // A phone with no card open (a chapter; a person's places come with their card): the screen between
          // the header, with the chapter's chip under it, and the timeline.
          { top: 64 + (chip ? 56 : 0), bottom: timeline + 24, left: 0, right: 0 }
        : w < 768
          ? // The card stands on the timeline (20 px above it), up to 48% of the screen tall.
            {
              top: Math.max(64, top),
              bottom: Math.max(h * 0.55, timeline + 20 + h * 0.48),
              left: 0,
              right: 0,
            }
          : !card
            ? // No card open (a chapter, the map alone): only the column and the timeline.
              { top, bottom, left: column, right: 0 }
            : beside >= 400 || h < 600
              ? { top, bottom, left: column, right: cardEdge }
              : { top: 360, bottom, left: column, right: 0 };
  const kx = Math.min(1, (w - 60) / (p.left + p.right || 1));
  const ky = Math.min(1, (h - 80) / (p.top + p.bottom));
  return {
    top: Math.round(p.top * ky),
    bottom: Math.round(p.bottom * ky),
    left: Math.round(p.left * kx),
    right: Math.round(p.right * kx),
  };
}
