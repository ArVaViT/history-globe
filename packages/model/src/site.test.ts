import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEACON_SCRIPT } from "./beacon.ts";
import { NOTICE, SITE } from "./notice.ts";
import { SITE_ORIGIN } from "./site.ts";

const root = join(import.meta.dirname, "../../..");

/**
 * Code that still writes the site's address out: the licence and credit wording, which the
 * licence work keeps verbatim (notice.ts, beacon.ts, whose bytes the CSP hashes, the agent
 * tools' and the API's credit lines), the Python dataset build, and a comment. Code anywhere
 * else takes SITE_ORIGIN, so a copy published elsewhere changes one line.
 */
const WRITTEN_OUT = new Set([
  "apps/web/src/agent-tools.ts",
  "packages/model/src/beacon.ts",
  "packages/model/src/notice.ts",
  "pipeline/build_dataset.py",
  "scripts/build-api.ts",
  "scripts/indexnow.ts",
]);

describe("the site's address", () => {
  it("is written out only where its wording is kept verbatim", () => {
    const files = execFileSync(
      "git",
      ["grep", "-l", "https://historyglobe\\.app", "--", "*.ts", "*.tsx", "*.py"],
      { cwd: root, encoding: "utf8" },
    )
      .split("\n")
      .filter(
        (f) => f && !/(\.test\.ts|\/test_\w+\.py)$/.test(f) && f !== "packages/model/src/site.ts",
      );
    expect(files.filter((f) => !WRITTEN_OUT.has(f))).toEqual([]);
  });

  it("is the one the notice and the beacon name", () => {
    expect(SITE).toBe(SITE_ORIGIN);
    expect(NOTICE).toContain(`${SITE_ORIGIN}/api/v1/`);
    expect(BEACON_SCRIPT).toContain(`"${SITE_ORIGIN}/"`);
  });
});
