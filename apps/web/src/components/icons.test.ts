// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

/** Exports whose name is not their Lucide name in PascalCase. */
const LUCIDE_NAME: Record<string, string> = { Settings: "settings-2", MapIcon: "map" };
/** Icons Lucide has renamed since its licence listed those it took from Feather. */
const FORMER_NAME: Record<string, string> = {
  ellipsis: "more-horizontal",
  "circle-help": "help-circle",
};

const notice = readFileSync(
  join(import.meta.dirname, "../../public/licenses/lucide-icons.txt"),
  "utf8",
);
const list = (s: string | undefined) => (s ?? "").split(/,\s*/).map((n) => n.trim());

// The licence file ships with the app and names the icons it covers: it must name these.
describe("the icons' licence notice", () => {
  const used = Object.keys(icons)
    .map((n) => LUCIDE_NAME[n] ?? n.replace(/(?<!^)(?=[A-Z])/g, "-").toLowerCase())
    .sort();

  it("lists every icon the app copies from Lucide", () => {
    expect(list(/copied from Lucide [\d.]+:\s+([\s\S]*?)\. Of these/.exec(notice)?.[1])).toEqual(
      used,
    );
  });

  it("says which of them derive from Feather", () => {
    const feather = new Set(list(/derived from the Feather project:\n\n(.*)\n/.exec(notice)?.[1]));
    const derived = used.filter((n) => feather.has(n) || feather.has(FORMER_NAME[n] ?? ""));
    expect(list(/Of these,\s+([\s\S]*?)\s+derive from Feather/.exec(notice)?.[1])).toEqual(derived);
  });
});
