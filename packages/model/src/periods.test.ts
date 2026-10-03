import { describe, expect, it } from "vitest";
import { PERIODS, periodAt } from "./periods.ts";

describe("periods", () => {
  it("are contiguous, without gaps or overlaps, from 3500 BC to AD 1300", () => {
    expect(PERIODS[0]?.range.from).toBe(-3499);
    expect(PERIODS.at(-1)?.range.to).toBe(1301);
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
    [-2999, "eb2"], // 3000 BC
    [135, "roman"], // Bar Kokhba's revolt ends
    [325, "byzantine"], // Council of Nicaea
    [638, "early-islamic"], // Jerusalem surrenders to Umar
    [1099, "crusader"], // the First Crusade takes Jerusalem
    [1291, "crusader"], // Acre falls
  ])("year %i is in %s", (year, id) => {
    expect(periodAt(year)?.id).toBe(id);
  });
});
