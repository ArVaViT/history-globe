// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * The Bible's books (pipeline/bible-books.json, which the pipeline reads too): the codes two
 * sources use for them, to OSIS, in the canon's order.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const books = JSON.parse(
  readFileSync(join(import.meta.dirname, "../pipeline/bible-books.json"), "utf8"),
) as { usfm: Record<string, string>; step: Record<string, string> };

/** USFM book codes (eBible.org) → OSIS. */
export const USFM_TO_OSIS: Readonly<Record<string, string>> = books.usfm;
/** STEPBible's book abbreviations → OSIS, with the variant spellings TIPNR also uses. */
export const STEP_TO_OSIS: Readonly<Record<string, string>> = books.step;
