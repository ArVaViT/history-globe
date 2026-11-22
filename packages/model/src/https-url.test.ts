import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { httpsUrl } from "./https-url.ts";

describe("httpsUrl", () => {
  it("takes an https address", () => {
    expect(httpsUrl.parse("https://pleiades.stoa.org/places/658381")).toBe(
      "https://pleiades.stoa.org/places/658381",
    );
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<b>x</b>",
    "http://example.org/",
    "ftp://example.org/",
    "//example.org/",
    "example.org",
  ])("refuses %s", (url) => {
    expect(httpsUrl.safeParse(url).success).toBe(false);
  });

  // A bare z.url() takes javascript: and data: addresses: every schema uses httpsUrl.
  it("is the only kind of address the schemas declare", () => {
    const dir = import.meta.dirname;
    const bare = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "https-url.ts")
      .filter((f) => /\bz\.url\(|\.url\(\)/.test(readFileSync(join(dir, f), "utf8")));
    expect(bare).toEqual([]);
  });
});
