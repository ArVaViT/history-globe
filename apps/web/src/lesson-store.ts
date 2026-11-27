// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/**
 * The lesson a teacher builds place by place (lesson.ts), kept in this browser until it is
 * cleared, and shared by every view of it (the place card's button, the lesson tool): one
 * store, so a place added in one shows in the other at once. With storage refused it lives
 * as long as the page.
 */
import { useState, useSyncExternalStore } from "react";
import { LESSON_MAX, type LessonStop } from "./lesson";
import { readPref, writePref } from "./storage";

const KEY = "hg:lesson";
const TITLE_KEY = "hg:lesson-title";
/** Where lessons were kept before the keys took the `hg:` form of the others. */
const OLD_KEY = "hg-lesson";
const OLD_TITLE_KEY = "hg-lesson-title";

/** A key's value, or its value under the old key: a lesson in progress is not lost. */
const readKept = (key: string, old: string) => readPref(key) ?? readPref(old);

function readPicked(): LessonStop[] {
  try {
    const v = JSON.parse(readKept(KEY, OLD_KEY) ?? "[]") as unknown;
    return Array.isArray(v)
      ? v.filter(
          (x): x is LessonStop =>
            typeof (x as LessonStop | null)?.id === "string" &&
            ["number", "undefined"].includes(typeof (x as LessonStop).year),
        )
      : [];
  } catch {
    return [];
  }
}

function writeLesson(picked: readonly LessonStop[], title: string): void {
  writePref(KEY, picked.length ? JSON.stringify(picked) : null);
  writePref(TITLE_KEY, title || null);
  writePref(OLD_KEY, null);
  writePref(OLD_TITLE_KEY, null);
}

const listeners = new Set<() => void>();
let snapshot: { picked: readonly LessonStop[]; title: string } | null = null;
const current = () =>
  (snapshot ??= { picked: readPicked(), title: readKept(TITLE_KEY, OLD_TITLE_KEY) ?? "" });
function setLesson(picked: readonly LessonStop[], title: string): void {
  writeLesson(picked, title);
  snapshot = { picked: [...picked], title };
  for (const f of listeners) f();
}
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
/** The lesson as it stands, kept up to date. */
export const useLessonStore = () => useSyncExternalStore(subscribe, current, current);
/** Adds a place at a year (the lesson tool adds every place opened); false when full. */
export function addToLesson(stop: LessonStop): boolean {
  const { picked, title } = current();
  if (picked.some((s) => s.id === stop.id)) return true;
  if (picked.length >= LESSON_MAX) return false;
  setLesson([...picked, stop], title);
  return true;
}
/** Takes a place out of the lesson. */
export function removeFromLesson(id: string): void {
  const { picked, title } = current();
  setLesson(
    picked.filter((s) => s.id !== id),
    title,
  );
}

export interface Lesson {
  readonly picked: readonly LessonStop[];
  /** The name the teacher gives the lesson: the title of its tour and of its sheet. */
  readonly title: string;
  readonly setTitle: (title: string) => void;
  readonly inLesson: boolean;
  /** No room for another place (LESSON_MAX). */
  readonly full: boolean;
  /** The year this place would be added at: the map's. */
  readonly year: number;
  readonly toggle: () => void;
  readonly clear: () => void;
  /** The lesson just cleared, to bring back (until another change). */
  readonly undo: (() => void) | null;
}

/**
 * A teacher's lesson, built place by place from the cards (lesson.ts): kept in this
 * browser until cleared; this place is added at the year the map shows.
 */
export function useLesson(placeId: string, year: number): Lesson {
  const { picked, title } = useLessonStore();
  const [cleared, setCleared] = useState<{ ids: LessonStop[]; title: string } | null>(null);
  const save = (ids: LessonStop[], name = title) => {
    setLesson(ids, name);
    setCleared(null);
  };
  const inLesson = picked.some((s) => s.id === placeId);
  const full = !inLesson && picked.length >= LESSON_MAX;
  return {
    picked,
    title,
    setTitle: (name) => {
      setLesson(picked, name);
    },
    inLesson,
    full,
    year,
    toggle: () => {
      if (inLesson) save(picked.filter((s) => s.id !== placeId));
      else if (!full) save([...picked, { id: placeId, year }]);
    },
    clear: () => {
      const was = { ids: [...picked], title };
      save([], "");
      setCleared(was);
    },
    undo: cleared
      ? () => {
          save(cleared.ids, cleared.title);
        }
      : null,
  };
}
