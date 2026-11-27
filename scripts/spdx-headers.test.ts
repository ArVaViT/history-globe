// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { headedFiles, hasHeader, missingHeaders, withHeader } from "./spdx-headers.ts";

describe("the licence header of the code (LICENSING.md, part 1)", () => {
  it("is at the top of every source file", () => {
    expect(missingHeaders(), "node scripts/spdx-headers.ts --fix").toEqual([]);
  });

  it("is not put in the articles, the data, the MIT script or generated files", () => {
    const files = headedFiles();
    expect(files).toContain("apps/web/src/App.tsx");
    expect(files).toContain("pipeline/build_data.py");
    expect(files.some((p) => p.startsWith("content/"))).toBe(false);
    expect(files.some((p) => /hg-places/.test(p) && p.startsWith("apps/web/public/"))).toBe(false);
    expect(files).not.toContain("packages/model/src/versification.ts");
  });

  it("keeps a shebang first", () => {
    const out = withHeader("#!/usr/bin/env bash\nset -e\n", "hash");
    expect(out.split("\n").slice(0, 4)).toEqual([
      "#!/usr/bin/env bash",
      "# SPDX-License-Identifier: AGPL-3.0-or-later",
      "# Additional terms under section 7: see LICENSING.md",
      "",
    ]);
    expect(hasHeader(out, "hash")).toBe(true);
    expect(withHeader(out, "hash")).toBe(out);
  });
});
