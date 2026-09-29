import { describe, expect, it } from "vitest";
import { tourSpan } from "./ToursPanel";

describe("tourSpan", () => {
  it("spans from the first verse of the first stop to the last verse of the last stop", () => {
    expect(tourSpan([{ ref: "Acts.13.1-Acts.13.3" }, { ref: "Acts.14.26-Acts.14.28" }], "ru")).toBe(
      "Деян 13:1–14:28",
    );
    expect(tourSpan([{ ref: "Acts.27.1" }, { ref: "Acts.28.16" }], "en")).toBe("Acts 27:1–28:16");
  });
});
