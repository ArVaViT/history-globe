// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { createContext, useContext } from "react";

/** How the app is framed, read once from the address (main.tsx): `embed=1` and `ui=map`. */
export interface Frame {
  /** Inside another site's page (docs/embed-protocol.md). */
  readonly embed: boolean;
  /** Embedded with `ui=map`: the host has its own search and place box. */
  readonly mapOnly: boolean;
}

export const FrameContext = createContext<Frame>({ embed: false, mapOnly: false });

export const useFrame = (): Frame => useContext(FrameContext);

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
