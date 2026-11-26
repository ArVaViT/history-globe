// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { afterMoveEnd, type MoveEnds } from "./after-move.ts";

/**
 * A camera as MapLibre runs one: `flyTo` stops the move under way, which fires "moveend"
 * at once, and only then sets its own frame. A frame set by a listener in between is lost.
 */
class Camera implements MoveEnds {
  private listeners: (() => void)[] = [];
  frame: string | null = null;
  orphans: string[] = [];
  once(_type: "moveend", listener: () => void): void {
    this.listeners.push(listener);
  }
  flyTo(name: string): void {
    this.stop();
    if (this.frame) this.orphans.push(this.frame);
    this.frame = name;
  }
  stop(): void {
    this.frame = null;
    const ls = this.listeners;
    this.listeners = [];
    for (const l of ls) l();
  }
  isMoving(): boolean {
    return this.frame !== null;
  }
}

describe("afterMoveEnd", () => {
  it("runs after the call that ended the move, not inside it", async () => {
    const cam = new Camera();
    cam.flyTo("first");
    const seen: boolean[] = [];
    afterMoveEnd(cam, () => {
      seen.push(cam.isMoving());
      if (!cam.isMoving()) cam.flyTo("padding");
    });
    cam.flyTo("second");
    // Inside flyTo the listener ran, but nothing has run yet: no frame was overwritten.
    expect(seen).toEqual([]);
    await Promise.resolve();
    // It sees the second flight under way, so it leaves it alone.
    expect(seen).toEqual([true]);
    expect(cam.frame).toBe("second");
    expect(cam.orphans).toEqual([]);
  });

  it("a listener that moves the camera at once loses its frame (what it prevents)", () => {
    const cam = new Camera();
    cam.flyTo("first");
    cam.once("moveend", () => {
      cam.flyTo("padding");
    });
    cam.flyTo("second");
    expect(cam.orphans).toEqual(["padding"]);
  });

  it("runs once the camera ends a move by itself", async () => {
    const cam = new Camera();
    cam.flyTo("first");
    let ran = 0;
    afterMoveEnd(cam, () => {
      ran++;
    });
    cam.stop();
    await Promise.resolve();
    expect(ran).toBe(1);
  });
});
