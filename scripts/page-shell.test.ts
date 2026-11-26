// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { BEACON_TAG } from "../packages/model/src/beacon.ts";
import { bodyEnd } from "./page-shell.ts";

describe("the end of a built page", () => {
  it("carries the beacon in the production build", () => {
    expect(bodyEnd("../", "https://historyglobe.app")).toContain(BEACON_TAG);
  });

  it.each(["", "https://globe.example.org"])("carries no beacon in a build for %j", (site) => {
    const end = bodyEnd("../", site);
    expect(end).not.toContain("<script");
    expect(end).toContain('href="../export/"');
  });
});
