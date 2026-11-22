import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { ANALYTICS_SCRIPT, ANALYTICS_SRC, ANALYTICS_TAG } from "./analytics.ts";

type BeforeSend = (e: { type: string; url: string }) => { type: string; url: string } | null;

/** Runs the script as a page at `href` would, framed or not: what it queued and loaded. */
function run(href: string, framed = false) {
  const appended: { src: string; defer: boolean }[] = [];
  const window: { vaq?: [string, BeforeSend][]; self: object; top: object } = {
    self: {},
    top: {},
  };
  if (!framed) window.top = window.self;
  runInNewContext(ANALYTICS_SCRIPT, {
    window,
    location: new URL(href),
    URL,
    document: {
      createElement: () => ({ src: "", defer: false }),
      head: { appendChild: (s: { src: string; defer: boolean }) => appended.push(s) },
    },
  });
  const beforeSend = window.vaq?.find(([k]) => k === "beforeSend")?.[1];
  return { appended, beforeSend };
}

describe("visit counts", () => {
  it("load the counter on the site itself, in a tab of its own", () => {
    const { appended } = run("https://historyglobe.app/en/place/bethel/");
    expect(appended).toEqual([{ src: ANALYTICS_SRC, defer: true }]);
  });

  it.each([
    ["a frame on another site's page", "https://historyglobe.app/?embed=1", true],
    ["a preview", "https://history-globe-git-x-team.vercel.app/", false],
    ["the project's own vercel.app address", "https://history-globe.vercel.app/", false],
    ["a developer's machine", "http://localhost:5173/", false],
    ["a copy on another host", "https://example.org/en/", false],
  ])("count nothing in %s", (_, href, framed) => {
    const { appended, beforeSend } = run(href, framed);
    expect(appended).toEqual([]);
    expect(beforeSend).toBeUndefined();
  });

  it("send the path alone: no lesson title, no query, no fragment", () => {
    const { beforeSend } = run("https://historyglobe.app/");
    const sent = beforeSend?.({
      type: "pageview",
      url: "https://historyglobe.app/?lesson=a15257a~30&tour=lesson&locale=en&title=My+class+on+Paul#x",
    });
    expect(sent?.url).toBe("https://historyglobe.app/");
    expect(
      beforeSend?.({ type: "pageview", url: "https://historyglobe.app/de/place/bethel/?q=1" })?.url,
    ).toBe("https://historyglobe.app/de/place/bethel/");
  });

  it("is one inline script, without imports, as the pages carry it", () => {
    expect(ANALYTICS_TAG).toBe(`<script>${ANALYTICS_SCRIPT}</script>`);
    expect(ANALYTICS_SCRIPT).not.toMatch(/\bimport\b|<\/script/);
  });

  it("is allowed by hash in every Content-Security-Policy", () => {
    const vercel = JSON.parse(
      readFileSync(join(import.meta.dirname, "../../../apps/web/vercel.json"), "utf8"),
    ) as { headers: { headers: { key: string; value: string }[] }[] };
    const policies = vercel.headers.flatMap((h) =>
      h.headers.filter((x) => x.key === "Content-Security-Policy").map((x) => x.value),
    );
    expect(policies.length).toBeGreaterThan(0);
    const hash = `'sha256-${createHash("sha256").update(ANALYTICS_SCRIPT).digest("base64")}'`;
    for (const p of policies) expect(/script-src([^;]*)/.exec(p)?.[1]).toContain(hash);
  });
});
