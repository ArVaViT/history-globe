import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { BEACON_PATH, BEACON_SCRIPT, BEACON_TAG, OWN_HOSTS } from "./beacon.ts";

/** Runs the very script a page carries, on a page at this address, and tells what it did. */
function runOn(hostname: string, protocol = "https:") {
  const requests: string[] = [];
  const added: { href?: string; textContent?: string; style: { cssText?: string } }[] = [];
  class Image {
    set src(url: string) {
      requests.push(url);
    }
  }
  const document = {
    createElement: () => ({ style: {} }),
    body: { appendChild: (el: (typeof added)[number]) => added.push(el) },
  };
  runInNewContext(BEACON_SCRIPT, { location: { hostname, protocol }, Image, document });
  return { requests, added };
}

describe("the beacon", () => {
  it.each([
    "historyglobe.app",
    "localhost",
    "127.0.0.1",
    "[::1]",
    "history-globe.vercel.app",
    "history-globe-git-main-arvavit.vercel.app",
    "history-globe-a1b2c3d4e-arvavit.vercel.app",
  ])("is silent on %s", (host) => {
    expect(OWN_HOSTS.test(host)).toBe(true);
    expect(runOn(host)).toEqual({ requests: [], added: [] });
  });

  // The embed address and the embed mode are the site's own pages in another site's frame.
  it("is silent on the site's pages framed by another site", () => {
    expect(runOn("historyglobe.app", "https:")).toEqual({ requests: [], added: [] });
  });

  it("is silent on a page opened from a file", () => {
    expect(runOn("", "file:")).toEqual({ requests: [], added: [] });
  });

  it.each([
    "copy.example",
    "historyglobe.app.copy.example",
    "www.historyglobe.app",
    "history-globe.example.org",
    "other-project.vercel.app",
    "history-globe.netlify.app",
  ])(
    "on %s asks the site for one image that names the host, and says where the original is",
    (host) => {
      expect(OWN_HOSTS.test(host)).toBe(false);
      const { requests, added } = runOn(host);
      expect(requests).toEqual([
        `https://historyglobe.app${BEACON_PATH}${encodeURIComponent(host)}`,
      ]);
      expect(added).toHaveLength(1);
      expect(added[0]?.href).toBe("https://historyglobe.app/");
      expect(added[0]?.textContent).toBe("Original: historyglobe.app");
      expect(added[0]?.style.cssText).toContain("position:fixed");
    },
  );

  it("sends nothing but the host: no query, no cookie, no reader", () => {
    const { requests } = runOn("copy.example", "http:");
    expect(requests[0]).not.toMatch(/[?&=]/);
    expect(BEACON_SCRIPT).not.toMatch(/cookie|navigator|localStorage|referrer|userAgent/);
  });

  it("is allowed by hash in every Content-Security-Policy, and may reach the site from a copy", () => {
    const vercel = JSON.parse(
      readFileSync(join(import.meta.dirname, "../../../apps/web/vercel.json"), "utf8"),
    ) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const policies = vercel.headers.flatMap((h) =>
      h.headers.filter((x) => x.key === "Content-Security-Policy").map((x) => x.value),
    );
    expect(policies.length).toBeGreaterThan(0);
    const hash = `'sha256-${createHash("sha256").update(BEACON_SCRIPT).digest("base64")}'`;
    for (const p of policies) {
      expect(/script-src([^;]*)/.exec(p)?.[1]).toContain(hash);
      // A copy that kept the site's headers would block the image without this.
      expect(/img-src([^;]*)/.exec(p)?.[1]).toContain(" https://historyglobe.app");
    }
    expect(BEACON_TAG).toBe(`<script>${BEACON_SCRIPT}</script>`);
  });
});
