/**
 * What an embedded frame shows (App.tsx, docs/embed-protocol.md). A frame is compact (the
 * chip above, the year folded below, no column) when it is small, or always when it is
 * map-only (`ui=map`): a host with its own search and place box gets the map, the year and
 * the link to the globe, and neither our card nor our chapter bar.
 */
export function frameParts(
  embed: boolean,
  mapOnly: boolean,
  bigFrame: boolean,
): { readonly compact: boolean; readonly card: boolean; readonly chapter: boolean } {
  const bare = embed && mapOnly;
  return { compact: embed && (bare || !bigFrame), card: !bare, chapter: !bare };
}
