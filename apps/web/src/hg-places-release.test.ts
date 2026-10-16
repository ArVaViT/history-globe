import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Other sites load the places-in-any-text script by a versioned address with an integrity
 * hash (content/docs embedding.html). A version, once out, never changes: its file must
 * match the hash its partners pinned; and the newest version is the script as it is now,
 * so a change to hg-places.js comes with a new version (scripts/hg-places-releases.json).
 */
const root = join(import.meta.dirname, "../../..");
const pub = join(root, "apps/web/public");
const releases = JSON.parse(
  readFileSync(join(root, "scripts/hg-places-releases.json"), "utf8"),
) as { latest: string; versions: Record<string, string> };
const sri = (file: string) =>
  `sha384-${createHash("sha384").update(readFileSync(file)).digest("base64")}`;

describe("hg-places releases", () => {
  it("keeps every released version exactly as it was published", () => {
    for (const [version, hash] of Object.entries(releases.versions))
      expect(sri(join(pub, `hg-places-${version}.js`)), version).toBe(hash);
  });

  it("has the current script as its newest version", () => {
    expect(releases.versions[releases.latest]).toBeDefined();
    expect(readFileSync(join(pub, `hg-places-${releases.latest}.js`), "utf8")).toBe(
      readFileSync(join(pub, "hg-places.js"), "utf8"),
    );
  });
});
