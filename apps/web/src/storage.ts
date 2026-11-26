// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * What this browser remembers for the reader: settings in localStorage, a visit's state in
 * sessionStorage. Storage may be refused (a private window, blocked site data): a read then
 * gives null and a write is dropped, so the setting holds for this visit only.
 */
type Area = "local" | "session";

const store = (area: Area): Storage => (area === "local" ? localStorage : sessionStorage);

export function readPref(key: string, area: Area = "local"): string | null {
  try {
    return store(area).getItem(key);
  } catch {
    return null;
  }
}

/** Keeps a value; null forgets it. */
export function writePref(key: string, value: string | null, area: Area = "local"): void {
  try {
    if (value === null) store(area).removeItem(key);
    else store(area).setItem(key, value);
  } catch {
    // Refused: nothing is kept, and nothing needs to be.
  }
}
