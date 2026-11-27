// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { Emitter } from "./emitter.ts";

describe("Emitter", () => {
  it("calls each handler of an event with its arguments, until it is taken off", () => {
    const events = new Emitter<{ pick: (id: string) => void; ready: () => void }>();
    const got: string[] = [];
    const off = events.on("pick", (id) => got.push(id));
    events.on("ready", () => got.push("ready"));
    events.emit("pick", "a");
    off();
    events.emit("pick", "b");
    events.emit("ready");
    expect(got).toEqual(["a", "ready"]);
  });

  it("drops every handler on clear", () => {
    const events = new Emitter<{ ready: () => void }>();
    let calls = 0;
    events.on("ready", () => (calls += 1));
    events.clear();
    events.emit("ready");
    expect(calls).toBe(0);
  });
});
