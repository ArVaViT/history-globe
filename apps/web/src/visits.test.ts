import { describe, expect, it } from "vitest";
import { countsAsVisit } from "./visits";

describe("visit counts", () => {
  it("count the site itself, in a production build, in a tab of its own", () => {
    expect(countsAsVisit(true, "historyglobe.app", false)).toBe(true);
  });

  it("do not count a frame on another site's page", () => {
    expect(countsAsVisit(true, "historyglobe.app", true)).toBe(false);
  });

  it("do not count development, a preview or another host", () => {
    expect(countsAsVisit(false, "historyglobe.app", false)).toBe(false);
    expect(countsAsVisit(true, "history-globe-git-x.vercel.app", false)).toBe(false);
    expect(countsAsVisit(true, "localhost", false)).toBe(false);
  });
});
