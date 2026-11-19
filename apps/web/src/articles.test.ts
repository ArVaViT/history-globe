import { afterEach, describe, expect, it, vi } from "vitest";
import { loadArticle, loadQuestions } from "./articles";

const fetched: string[] = [];
const answer = (ok: boolean) =>
  vi.fn((url: string) => {
    fetched.push(url);
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve({ a1: { id: "x", body: { uk: ["Один."] } } }),
    });
  });

describe("the articles, one language a file", () => {
  afterEach(() => {
    fetched.length = 0;
    vi.unstubAllGlobals();
  });

  it("fetches the language shown once, and English for a language the site has not", async () => {
    vi.stubGlobal("fetch", answer(true));
    expect(await loadArticle("a1", "uk")).toMatchObject({ id: "x" });
    expect(await loadArticle("a2", "uk")).toBeUndefined();
    expect(await loadArticle("a1", "zh")).toMatchObject({ id: "x" });
    expect(fetched).toEqual(["/data/articles/uk.json", "/data/articles/en.json"]);
  });

  it("tries again after a failed load", async () => {
    vi.stubGlobal("fetch", answer(false));
    await expect(loadArticle("a1", "de")).rejects.toThrow("articles/de.json: 500");
    vi.stubGlobal("fetch", answer(true));
    expect(await loadArticle("a1", "de")).toMatchObject({ id: "x" });
    expect(fetched).toEqual(["/data/articles/de.json", "/data/articles/de.json"]);
  });
});

describe("the questions of a place, beside the articles under their licence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the language shown from articles/questions/, and none when it cannot", async () => {
    const urls: string[] = [];
    const titles = {
      license: "CC BY-NC-ND 4.0",
      license_url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
      questions: { a1: [{ id: "where-was-a1", fi: "Missä oli A1?" }] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        urls.push(url);
        const ok = url.endsWith("/fi.json");
        return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(titles) });
      }),
    );
    expect(await loadQuestions("a1", "fi")).toEqual([{ id: "where-was-a1", fi: "Missä oli A1?" }]);
    expect(await loadQuestions("a2", "fi")).toEqual([]);
    expect(await loadQuestions("a1", "sv")).toEqual([]);
    expect(urls).toEqual(["/data/articles/questions/fi.json", "/data/articles/questions/sv.json"]);
  });
});
