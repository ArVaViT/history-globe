/** The widest screen laid out as a phone's: one below Tailwind's `md` (768 px). */
export const NARROW_MAX_PX = 767;
/** The same as a media query, for `useMedia`. */
export const NARROW = `(max-width: ${String(NARROW_MAX_PX)}px)`;
export const isNarrow = (w = innerWidth): boolean => w <= NARROW_MAX_PX;

/** The timeline's height before it is measured (`--hg-timeline-h`). */
export const TIMELINE_FALLBACK_PX = 124;

/** The left column: 360 px wide at 16 px from the edge. */
const COLUMN = 360 + 16;
/** The card: 420 px wide at 16 px from the right edge, and 16 px between it and the map. */
const CARD = 420 + 2 * 16;
/** An embed keeps 40 px more of the right edge for the map's zoom buttons. */
const EMBED_CARD = CARD + 40;
/** The header bar, and the chapter's chip under it. */
const HEADER = 64;
const CHIP = 56;
/** The full-width timeline and the gap above it. */
const TIMELINE_ROOM = 190;

export interface PaddingLayout {
  readonly w?: number;
  readonly h?: number;
  /** A compact frame on another site: no column, the chip at the top, the year folded. */
  readonly embed?: boolean;
  /** The timeline's measured height. */
  readonly timeline?: number;
  /** A card open (a place, a tour's stop, a person). */
  readonly card?: boolean;
  /** The chapter's chip under the header. */
  readonly chip?: boolean;
  /** A panel open in the left column (the overview, a tool, the search). */
  readonly panel?: boolean;
  /** A map-only frame (`ui=map`): no card, whatever is selected. */
  readonly mapOnly?: boolean;
}

/**
 * Where the interface leaves the map open, for a flight to put its place there. On a phone
 * the header covers the top and the card and the timeline the lower half; wider, the
 * panels cover the left, the timeline the bottom and the card the top right: beside the
 * card when there is room or the screen is short (below it there would be no map left),
 * below it otherwise. Each axis is shrunk to fit on its own, which MapLibre would otherwise
 * clamp.
 */
export function viewPadding({
  w = innerWidth,
  h = innerHeight,
  embed = false,
  timeline = TIMELINE_FALLBACK_PX,
  card = true,
  chip = false,
  panel = true,
  mapOnly = false,
}: PaddingLayout = {}) {
  const open = card && !(embed && mapOnly);
  // Embedded, the chip (or map-only, the smaller link to the globe) sits at the top and the
  // timeline is folded to a line until opened; with no card open, the frame is the map's.
  const column = embed || !panel ? 0 : COLUMN;
  const top = embed ? (mapOnly ? 44 : CHIP) : 0;
  const bottom = embed ? timeline + 24 : TIMELINE_ROOM;
  const cardEdge = embed ? EMBED_CARD : CARD;
  const beside = w - column - cardEdge;
  // Between the header (and the chip under it) and the timeline.
  const underHeader = {
    top: HEADER + (chip ? CHIP : 0),
    bottom: timeline + 24,
    left: 0,
    right: 0,
  };
  const p =
    embed && !open
      ? { top, bottom, left: 0, right: 0 }
      : isNarrow(w) && !open
        ? // A phone with no card open (a chapter; a person's places come with their card).
          underHeader
        : isNarrow(w)
          ? // The card stands on the timeline (20 px above it), up to 48% of the screen tall.
            {
              top: Math.max(HEADER, top),
              bottom: Math.max(h * 0.55, timeline + 20 + h * 0.48),
              left: 0,
              right: 0,
            }
          : !open
            ? // No card open: only the column and the timeline; on a short screen with no
              // panel (a phone on its side), the header and the chip cover the map's top-left
              // too, and the timeline is its own folded height.
              !embed && column === 0 && h < 600
              ? underHeader
              : { top, bottom, left: column, right: 0 }
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
