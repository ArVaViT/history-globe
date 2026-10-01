import { describe, expect, it } from "vitest";
import { ICON_NAMES, KIND_ICON } from "./icons.ts";
import { AREA_KINDS, SETTLEMENT_KINDS } from "./kinds.ts";

describe("place icons", () => {
  it("draws every icon a kind points to", () => {
    for (const icon of Object.values(KIND_ICON)) expect(ICON_NAMES).toContain(icon);
  });

  it("leaves towns and areas to their dots and labels", () => {
    for (const kind of [...SETTLEMENT_KINDS, ...AREA_KINDS])
      expect(KIND_ICON[kind]).toBeUndefined();
  });
});
