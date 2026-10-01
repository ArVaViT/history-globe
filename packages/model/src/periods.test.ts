import { describe, expect, it } from "vitest";
import { PERIODS, periodAt } from "./periods.ts";

describe("periods", () => {
  it("are contiguous, without gaps or overlaps, from 2000 BC to AD 100", () => {
    expect(PERIODS[0]?.range.from).toBe(-1999);
    expect(PERIODS.at(-1)?.range.to).toBe(101);
    for (let i = 1; i < PERIODS.length; i++) {
      expect(PERIODS[i]?.range.from).toBe(PERIODS[i - 1]?.range.to);
    }
  });

  it.each([
    [-721, "iron2b"], // fall of Samaria, 722 BC
    [-585, "babylonian"], // fall of Jerusalem, 586 BC
    [-36, "early-roman"], // Herod takes Jerusalem, 37 BC
    [30, "early-roman"],
    [70, "early-roman"],
    [71, "roman"],
  ])("year %i is in %s", (year, id) => {
    expect(periodAt(year)?.id).toBe(id);
  });
});
