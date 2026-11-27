// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * docs/data-release.md names every field the release carries, for whoever builds on it. The
 * content build checks what it writes against it (the states, content.json, the articles):
 * a field the page does not name stops the build until it is described there.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LOCALES } from "../packages/model/src/locales.ts";

const page = readFileSync(join(import.meta.dirname, "../docs/data-release.md"), "utf8");
/** Every name the page writes as code: `tier`, `{id, place, title}`, `name_<lang>`. */
const documented = new Set(
  [...page.matchAll(/`([^`]+)`/g)].flatMap(([, code = ""]) => code.split(/[\s{},]+/)),
);

/**
 * The fields of `what` that the page does not name. A field kept once per language
 * (`name_de`) is named by its pattern, `name_<lang>`.
 */
export function undocumented(what: string, keys: Iterable<string>): string[] {
  const missing = new Set(
    [...keys]
      .filter((k) => !documented.has(k))
      .map((k) => {
        const [, base, lang = ""] = /^(.*)_([a-z]{2})$/.exec(k) ?? [];
        return base && (ALL_LOCALES as readonly string[]).includes(lang) ? `${base}_<lang>` : k;
      })
      .filter((k) => !documented.has(k)),
  );
  return [...missing].map(
    (k) => `docs/data-release.md: ${what} has \`${k}\`, which it does not describe`,
  );
}
