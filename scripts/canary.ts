/**
 * Canary marks in the published data and texts (ADR 0017): small, deterministic choices
 * that change neither what a reader sees nor what the data says, only how it is written
 * down, so that a copy of the site or of a file can be told from an independent work.
 * Which records carry a mark follows from a seed the build reads from the environment
 * (HG_CANARY_SEED): without it the build writes the same files as before, with none.
 * Where the marks went is written to the file HG_CANARY_REGISTRY names, outside the
 * repository: the registry, not this code, is what a copy is checked against.
 *
 * The marks: one space more after a sentence's end in a paragraph of a text (HTML folds it,
 * JSON keeps it); two neighbouring records swapped in a list that promises no order; the
 * keys of a record in another order; the ids of a list in another order. Each is a fair
 * way to write the same thing; a copy repeats the choices, an independent work does not.
 */
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Mark =
  | {
      kind: "text";
      file: string;
      id: string;
      lang: string;
      paragraph: number;
      /** The sentence's end and what follows it, with the extra space, as the file has it. */
      context: string;
    }
  | { kind: "swap"; file: string; index: number; ids: [string, string] }
  | { kind: "keys"; file: string; id: string; keys: string[] }
  | { kind: "ids"; file: string; key: string; ids: string[] };

/** Rates: how many of the records of each kind carry a mark. */
export const RATES = { text: 1 / 40, swap: 1 / 50, keys: 1 / 30, ids: 1 / 30 } as const;

/** A sentence's end followed by a capital: where one space more is a fair way to write it. */
const SENTENCE_END = /\. (?=\p{Lu})/gu;
const CONTEXT = 24;

/** The registry's shape: the file HG_CANARY_REGISTRY names. */
export interface Registry {
  seed_fingerprint: string;
  stages: Record<
    string,
    { written_at: string; counts: Record<Mark["kind"], number>; marks: Mark[] }
  >;
}

export class Canaries {
  readonly marks: Mark[] = [];
  readonly on: boolean;
  private readonly seed: string;

  constructor(seed = process.env.HG_CANARY_SEED ?? "") {
    this.seed = seed;
    this.on = seed.length > 0;
  }

  /** A number in [0, 1) that only the seed and the label decide. */
  unit(label: string): number {
    const h = createHmac("sha256", this.seed).update(label).digest();
    return h.readUInt32BE(0) / 2 ** 32;
  }

  picked(label: string, rate: number): boolean {
    return this.on && this.unit(label) < rate;
  }

  /**
   * A text's paragraphs, with one space more after one sentence's end in one of them when
   * the text is picked; else the paragraphs as they came.
   */
  text(file: string, id: string, lang: string, paragraphs: readonly string[]): string[] {
    const label = `text:${id}:${lang}`;
    if (!this.picked(label, RATES.text)) return [...paragraphs];
    const ends: [number, number][] = [];
    paragraphs.forEach((p, i) => {
      for (const m of p.matchAll(SENTENCE_END)) ends.push([i, m.index]);
    });
    if (ends.length === 0) return [...paragraphs];
    const [paragraph, at] = ends[Math.floor(this.unit(`${label}:at`) * ends.length)] ?? [0, 0];
    const out = [...paragraphs];
    const p = out[paragraph] ?? "";
    const marked = `${p.slice(0, at + 1)}  ${p.slice(at + 2)}`;
    out[paragraph] = marked;
    this.marks.push({
      kind: "text",
      file,
      id,
      lang,
      paragraph,
      context: marked.slice(Math.max(0, at - CONTEXT), at + 2 + CONTEXT),
    });
    return out;
  }

  /** A list with some neighbouring pairs swapped; the list must promise no order. */
  swap<T>(file: string, items: readonly T[], idOf: (item: T) => string): T[] {
    const out = [...items];
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i] as T;
      const b = out[i + 1] as T;
      if (!this.picked(`swap:${file}:${idOf(a)}`, RATES.swap)) continue;
      out[i] = b;
      out[i + 1] = a;
      this.marks.push({ kind: "swap", file, index: i, ids: [idOf(b), idOf(a)] });
      i++; // A record moves once.
    }
    return out;
  }

  /** A record with its keys in another order when picked: the first key moves to the end. */
  keys<T extends object>(file: string, id: string, record: T): T {
    const entries = Object.entries(record);
    if (entries.length < 2 || !this.picked(`keys:${file}:${id}`, RATES.keys)) return record;
    const [first, ...rest] = entries;
    const out = Object.fromEntries([...rest, first as [string, unknown]]) as T;
    this.marks.push({ kind: "keys", file, id, keys: Object.keys(out) });
    return out;
  }

  /** A list of ids with its first two swapped when picked; the list must promise no order. */
  ids(file: string, key: string, ids: readonly string[]): string[] {
    if (ids.length < 2 || !this.picked(`ids:${file}:${key}`, RATES.ids)) return [...ids];
    const [a, b, ...rest] = ids as [string, string, ...string[]];
    const out = [b, a, ...rest];
    this.marks.push({ kind: "ids", file, key, ids: out });
    return out;
  }

  /**
   * Where the marks went, to the file HG_CANARY_REGISTRY names (outside the repository),
   * and one line of count to the console; nothing without the seed.
   */
  report(stage: string, path = process.env.HG_CANARY_REGISTRY): void {
    if (!this.on) {
      console.log(`canaries (${stage}): no HG_CANARY_SEED, none placed`);
      return;
    }
    const counts = { text: 0, swap: 0, keys: 0, ids: 0 };
    for (const m of this.marks) counts[m.kind]++;
    console.log(
      `canaries (${stage}): ${String(this.marks.length)} placed (text ${String(counts.text)}, swap ${String(counts.swap)}, keys ${String(counts.keys)}, ids ${String(counts.ids)})${path ? `, registry ${path}` : ", no HG_CANARY_REGISTRY, not written"}`,
    );
    if (!path) return;
    const fingerprint = createHmac("sha256", "history-globe")
      .update(this.seed)
      .digest("hex")
      .slice(0, 16);
    // One file for every stage of a build (content, api): a stage replaces its own marks and
    // keeps the others', as long as the seed is the same.
    const before = existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as Registry)
      : { seed_fingerprint: fingerprint, stages: {} };
    const stages = before.seed_fingerprint === fingerprint ? before.stages : {};
    stages[stage] = { written_at: new Date().toISOString(), counts, marks: this.marks };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ seed_fingerprint: fingerprint, stages }, null, 1));
  }
}
