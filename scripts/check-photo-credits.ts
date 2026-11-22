/**
 * Compares every photo of content/photos.yaml with its file's current metadata on Wikimedia
 * Commons: the licence and its version, the licence link, and the credit the author asks for
 * (scripts/photo-credits.ts says what must match). A file renamed or deleted on Commons is
 * reported too. It reads Commons, so it is run by hand, not by the build: before a release,
 * and after photos are added or changed.
 *
 * Usage: node scripts/check-photo-credits.ts  (pnpm photo-credits); exits 1 on any problem.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { compare, type CommonsMeta, type PhotoEntry } from "./photo-credits.ts";

const root = join(import.meta.dirname, "..");
// Wikimedia asks for an identifying User-Agent: the project, never a person.
const headers = {
  "User-Agent": "history-globe-photo-credits/1.0 (https://github.com/ArVaViT/history-globe)",
};
/** Titles per request (the API's limit) and the pause between requests. */
const BATCH = 50;
const PAUSE_MS = 1500;

const { photos } = parse(readFileSync(join(root, "content/photos.yaml"), "utf8")) as {
  photos: PhotoEntry[];
};

interface Answer {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; imageinfo?: { extmetadata?: CommonsMeta }[] }[];
  };
  error?: { code: string; info: string };
}

/** One request, again after a pause when Commons is busy (maxlag, 429, 5xx). */
async function ask(titles: string[]): Promise<Answer> {
  const body = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "extmetadata",
    iiextmetadatalanguage: "en",
    redirects: "1",
    maxlag: "5",
    titles: titles.join("|"),
  });
  for (let attempt = 1; ; attempt++) {
    const r = await fetch("https://commons.wikimedia.org/w/api.php", {
      method: "POST",
      body,
      headers,
      signal: AbortSignal.timeout(60_000),
    });
    const busy = r.status === 429 || r.status >= 500;
    const answer = busy ? undefined : ((await r.json()) as Answer);
    if (answer && answer.error?.code !== "maxlag") {
      if (answer.error) throw new Error(`Commons: ${answer.error.info}`);
      return answer;
    }
    if (attempt === 5) throw new Error(`Commons is busy (${String(r.status)}); try again later`);
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS * 2 ** attempt));
  }
}

const files = [...new Set(photos.map((p) => p.file))];
const meta = new Map<string, CommonsMeta>();
const problems: string[] = [];
for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  const answer = await ask(batch.map((f) => `File:${f}`));
  // Back from the title Commons answers with to the file name photos.yaml has.
  const back = new Map<string, string>();
  for (const f of batch) back.set(`File:${f}`, f);
  for (const { from, to } of answer.query?.normalized ?? []) back.set(to, back.get(from) ?? from);
  for (const { from, to } of answer.query?.redirects ?? []) {
    const file = back.get(from) ?? from;
    problems.push(`${file}: renamed on Commons to "${to.replace(/^File:/, "")}"`);
    back.set(to, file);
  }
  for (const page of answer.query?.pages ?? []) {
    const file = back.get(page.title) ?? page.title;
    const ext = page.imageinfo?.[0]?.extmetadata;
    if (page.missing || !ext) problems.push(`${file}: not on Commons`);
    else meta.set(file, ext);
  }
  if (i + BATCH < files.length) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

for (const photo of photos) {
  const m = meta.get(photo.file);
  if (m) problems.push(...compare(photo, m));
  else if (!problems.some((p) => p.startsWith(`${photo.file}: `)))
    problems.push(`${photo.file}: no answer from Commons`);
}
for (const p of problems) console.error(p);
console.log(
  `photo credits: ${String(photos.length)} photos, ${String(files.length)} files on Commons, ` +
    `${String(problems.length)} problems`,
);
if (problems.length) process.exit(1);
