import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { offlineFiles, savedFiles } from "../vite.config";

// A public/ folder as the build sees it: the data, a file kept only to rebuild it, a map.
const pub = mkdtempSync(join(tmpdir(), "hg-offline-"));
mkdirSync(join(pub, "data/photos"), { recursive: true });
writeFileSync(join(pub, "data/content.json"), "{}");
writeFileSync(join(pub, "data/polities-late.geojson"), "{}");
writeFileSync(join(pub, "data/photos/a000001.jpg"), "jpg");
writeFileSync(join(pub, "data/x.js.map"), "{}");
writeFileSync(join(pub, "manifest.webmanifest"), "{}");
writeFileSync(join(pub, "sitemap.xml"), "<x/>");
afterAll(() => {
  rmSync(pub, { recursive: true, force: true });
});

describe("the files a save for use offline fetches", () => {
  it("lists the data and the manifest, not the later states, maps or pages", () => {
    const { files, bytes } = savedFiles(pub);
    expect(files).toEqual(["data/content.json", "data/photos/a000001.jpg", "manifest.webmanifest"]);
    expect(bytes).toBe(2 + 3 + 2);
  });

  it("is a module of the build, not a file of its own", () => {
    // The hooks as plain functions, called as Vite would.
    const plugin = offlineFiles() as unknown as {
      configResolved: (c: { publicDir: string }) => void;
      resolveId: (id: string) => string | undefined;
      load: (id: string) => string | undefined;
    };
    plugin.configResolved({ publicDir: pub });
    expect(plugin.resolveId("other")).toBeUndefined();
    const id = plugin.resolveId("virtual:offline-files") ?? "";
    expect(id).not.toBe("");
    const code = plugin.load(id) ?? "";
    expect(code).toContain('"data/content.json"');
    expect(code).not.toContain("polities-late");
    expect(code).toMatch(/export const bytes = 7;/);
  });
});
