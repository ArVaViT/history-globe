/**
 * English (OSIS) chapter and verse → the Synodal numbering, for references shown in
 * Russian. Data and links keep the English numbering (BibleGateway's RUSV reads it and
 * shows the Synodal verse); a Russian reader with a printed Bible looks for Ps 67:16,
 * not Ps 68:15.
 *
 * Derived from the chapter lengths of the Synodal text (eBible.org "russyn", public
 * domain) against versification.ts, and checked verse by verse at every seam
 * (synodal.test.ts). Only differences that are certain are converted: the Psalms,
 * chapter boundaries that moved, and two verses joined into one. Chapters where the
 * Synodal text merges or adds verses elsewhere (Lev 14, Josh 24, Prov 4 and 13, Rom
 * 14-16, Rev 12) keep the English numbers.
 */
export interface ChapterVerse {
  readonly chapter: number;
  readonly verse: number | null;
}

/**
 * Verses added at the head of each psalm (English numbering) by titles the Synodal
 * text counts as verses: 0, 1 or 2. Psalms 10, 114-116 and 147 are handled apart.
 */
const PSALM_TITLE_VERSES =
  "001111111001000001111100000001100101011111011111102212111112111110111100001110011011100110010000000001000001000000000000000000000000000000010000000000";

/**
 * Chapters whose boundary moved: the same verses, cut elsewhere. For each run, its
 * first chapter, then the English and the Synodal lengths of its chapters.
 */
type Run = readonly [first: number, english: readonly number[], synodal: readonly number[]];
const SHIFTED: Readonly<Record<string, readonly Run[]>> = {
  "1Sam": [[23, [29, 22], [28, 23]]], // 1 Sam 23:29 (Engedi) is Synodal 24:1
  Num: [
    [12, [16, 33], [15, 34]], // Num 12:16 is Synodal 13:1
    [29, [40, 16], [39, 17]], // Num 29:40 is Synodal 30:1
  ],
  Josh: [[5, [15, 27], [16, 26]]], // Josh 6:1 is Synodal 5:16
  Job: [[39, [30, 24, 34], [35, 27, 26]]], // Job 41:1 (leviathan) is Synodal 40:20
  Eccl: [[4, [16, 20], [17, 19]]], // Eccl 5:1 is Synodal 4:17
  Song: [[6, [13, 13], [12, 14]]], // Song 6:13 is Synodal 7:1
  Dan: [[3, [30, 37], [33, 34]]], // Dan 4:1 is Synodal 3:31
  Hos: [[13, [16, 9], [15, 10]]], // Hos 13:16 is Synodal 14:1
  Jonah: [[1, [17, 10], [16, 11]]], // Jonah 1:17 is Synodal 2:1
};

/** From this English verse on, the chapter counts one less: two verses are one. */
const JOINED: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  Acts: { 19: 41 }, // Acts 19:40-41 is Synodal 19:40
  "2Cor": { 11: 33, 13: 13 }, // 2 Cor 11:32-33 is 11:32; 13:12-13 is 13:12
  Song: { 1: 2 }, // the title, Song 1:1, is not a Synodal verse: 1:14 (Engedi) is 1:13
  Isa: { 3: 24 }, // Isa 3:24 is Synodal 3:23 (the list of finery is one verse shorter)
};

/**
 * Psalms whose Synodal title is a verse of its own and two verses are joined further
 * on, so the count is the same but the numbers are not (English verse → Synodal).
 */
const PSALM_TITLE_AND_JOIN: Readonly<Record<number, (verse: number) => number>> = {
  13: (v) => (v <= 4 ? v + 1 : 6), // 13:5-6 are Synodal 12:6
  87: (v) => (v === 1 ? 2 : v), // 87:1-2 are Synodal 86:2
  90: (v) => (v <= 4 ? v + 1 : v <= 6 ? 6 : v), // 90:5-6 are Synodal 89:6
};

function psalm(chapter: number, verse: number | null): ChapterVerse {
  if (chapter === 10) return { chapter: 9, verse: verse === null ? null : verse + 21 };
  if (chapter === 114) return { chapter: 113, verse };
  if (chapter === 115) return { chapter: 113, verse: verse === null ? null : verse + 8 };
  if (chapter === 116)
    return verse !== null && verse >= 10
      ? { chapter: 115, verse: verse - 9 }
      : { chapter: 114, verse };
  if (chapter === 147)
    return verse !== null && verse >= 12
      ? { chapter: 147, verse: verse - 11 }
      : { chapter: 146, verse };
  const synodal = chapter <= 9 || chapter >= 148 ? chapter : chapter - 1;
  const joined = PSALM_TITLE_AND_JOIN[chapter];
  if (joined) return { chapter: synodal, verse: verse === null ? null : joined(verse) };
  const added = Number(PSALM_TITLE_VERSES[chapter - 1] ?? "0");
  return { chapter: synodal, verse: verse === null ? null : verse + added };
}

export function toSynodal(book: string, chapter: number, verse: number | null): ChapterVerse {
  if (book === "Ps") return psalm(chapter, verse);
  if (verse === null) return { chapter, verse };
  for (const [first, english, synodal] of SHIFTED[book] ?? []) {
    if (chapter < first || chapter >= first + synodal.length) continue;
    // The verse's place in the run, then the Synodal chapter it falls in.
    let index = verse;
    for (let c = first; c < chapter; c++) index += english[c - first] ?? 0;
    for (const [i, length] of synodal.entries()) {
      if (index <= length) return { chapter: first + i, verse: index };
      index -= length;
    }
  }
  const joined = JOINED[book]?.[chapter];
  if (joined !== undefined && verse >= joined) return { chapter, verse: verse - 1 };
  return { chapter, verse };
}
