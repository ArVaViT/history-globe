import { describe, expect, it } from "vitest";
import { tourSpan } from "./ToursPanel";

describe("tourSpan", () => {
  it("spans from the first verse of the first stop to the last verse of the last stop", () => {
    expect(tourSpan([{ ref: "Acts.13.1-Acts.13.3" }, { ref: "Acts.14.26-Acts.14.28" }], "ru")).toBe(
      "Деян 13:1–14:28",
    );
    expect(tourSpan([{ ref: "Acts.27.1" }, { ref: "Acts.28.16" }], "en")).toBe("Acts 27:1–28:16");
    expect(tourSpan([{ ref: "Matt.2.1" }, { ref: "Luke.24.50-Luke.24.53" }], "ru")).toBe(
      "Мф 2:1 – Лк 24:53",
    );
  });

  it("starts from the book's earliest verse when the tour opens with a later one", () => {
    const saul = [
      { ref: "Acts.22.3" },
      { ref: "Acts.7.58-Acts.8.3" },
      { ref: "Gal.1.17" },
      { ref: "Acts.11.26" },
    ];
    expect(tourSpan(saul, "ru")).toBe("Деян 7:58–11:26");
  });
});
