// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { BEACON_TAG } from "../../../packages/model/src/beacon.ts";
import type { Plugin } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import config from "../vite.config.ts";

/** Runs the app build's beacon step on a page, as the build would with this SITE_URL. */
function build(site: string | undefined): string {
  if (site === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = site;
  const plugin = (config.plugins as Plugin[]).find((p) => p.name === "beacon");
  const hook = plugin?.transformIndexHtml;
  if (!hook || typeof hook === "function") throw new Error("no beacon step");
  return hook.handler.call(undefined as never, "<body>\n  </body>", undefined as never) as string;
}

const saved = process.env.SITE_URL;
afterEach(() => {
  if (saved === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = saved;
});

describe("the app's page", () => {
  it("carries the beacon in the production build", () => {
    expect(build("https://historyglobe.app")).toContain(BEACON_TAG);
  });

  it.each([undefined, "https://globe.example.org"])("carries none in a build for %s", (site) => {
    expect(build(site)).toBe("<body>\n  </body>");
  });
});
