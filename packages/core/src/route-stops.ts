// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { LonLat } from "./renderer.ts";

/** Items grouped by the point they stand at (to 0.0001°), in the order each point first comes. */
export function groupByPoint<T>(items: readonly T[], at: (item: T) => LonLat): [T, ...T[]][] {
  const groups = new Map<string, [T, ...T[]]>();
  for (const item of items) {
    const [lon, lat] = at(item);
    const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()];
}

export interface StopDisc {
  readonly at: LonLat;
  /** The stop whose number the disc holds (0-based). */
  readonly shown: number;
  /** The other stops at the same place, written beside the disc. */
  readonly also: readonly number[];
}

/**
 * A route's stops as discs. A place the way comes back to (Antioch: stops 1, 6, 12 and 15) is
 * one disc, not four stacked with only the top number seen: it holds the number that matters
 * now (the current stop, else the next one there, else the last), the others beside it.
 */
export function stopDiscs(coordinates: readonly LonLat[], current: number): StopDisc[] {
  return groupByPoint([...coordinates.entries()], ([, at]) => at).map(([[first, at], ...rest]) => {
    const stops = [first, ...rest.map(([i]) => i)];
    const shown = stops.find((i) => i >= current) ?? Math.max(...stops);
    return { at, shown, also: stops.filter((i) => i !== shown) };
  });
}
