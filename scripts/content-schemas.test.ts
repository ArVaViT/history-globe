import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  AncientAuthorsFile,
  AncientSitesFile,
  AncientWaveCorrectionsFile,
  AncientWaveFile,
  ArticleFile,
  BattlesFile,
  ChapterYearsFile,
  EventsFile,
  LocaleNamesFile,
  ModernNamesFile,
  PhotosFile,
  PlaceLifeFile,
  PlaceNamesFile,
  PolityAnchorsFile,
  PolityNamesFile,
  PolityOverridesFile,
  QuestionFile,
  SourcesFile,
  TourFile,
} from "../packages/model/src/content.ts";
import { ReviewFile } from "../packages/model/src/reviews.ts";

// The content's shape (ADR 0007), file by file, as scripts/build-content.ts reads it. These
// need no data build, so CI runs them on every pull request; how the content holds to the
// places, the water and the years needs `pnpm data` and runs in the local gate.

const content = join(import.meta.dirname, "../content");
const load = (file: string): unknown => parse(readFileSync(join(content, file), "utf8"));
const folder = (dir: string) =>
  readdirSync(join(content, dir))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => `${dir}/${f}`);

/** What the test asks of a schema (zod's own types are the model package's). */
interface Schema {
  safeParse(data: unknown): { success: true } | { success: false; error: { issues: unknown[] } };
}

const FILES: readonly (readonly [string, Schema])[] = [
  ["place-names.yaml", PlaceNamesFile],
  ...readdirSync(content)
    .filter((f) => /^names-[a-z]{2}\.yaml$/.test(f))
    .map((f) => [f, LocaleNamesFile] as const),
  ["modern-names.yaml", ModernNamesFile],
  ["place-life.yaml", PlaceLifeFile],
  ["events.yaml", EventsFile],
  ["battles.yaml", BattlesFile],
  ["photos.yaml", PhotosFile],
  ["chapter-years.yaml", ChapterYearsFile],
  ...readdirSync(content)
    .filter((f) => /^sources-[a-z]{2}\.yaml$/.test(f))
    .map((f) => [f, SourcesFile] as const),
  ["ancient-authors.yaml", AncientAuthorsFile],
  ["ancient-sites.json", AncientSitesFile],
  ...readdirSync(content)
    .filter((f) => /^ancient-sites-wave\d+\.json$/.test(f))
    .map((f) => [f, AncientWaveFile] as const),
  ["ancient-wave-corrections.json", AncientWaveCorrectionsFile],
  ["polity-anchors.yaml", PolityAnchorsFile],
  ["polity-names.yaml", PolityNamesFile],
  ["polity-overrides.yaml", PolityOverridesFile],
  ...folder("reviews").map((f) => [f, ReviewFile] as const),
  ...folder("tours").map((f) => [f, TourFile] as const),
  ...folder("articles").map((f) => [f, ArticleFile] as const),
  ...folder("questions").map((f) => [f, QuestionFile] as const),
];

describe("the content files", () => {
  it.each(FILES)("%s has the schema's shape", (file, schema) => {
    const result = schema.safeParse(load(file));
    expect(result.success ? [] : result.error.issues.slice(0, 5)).toEqual([]);
  });
});
