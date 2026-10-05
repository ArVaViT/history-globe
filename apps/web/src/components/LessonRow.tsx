import type { Locale } from "@hg/model";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "../i18n";
import { LESSON_MAX, lessonSearch, TITLE_MAX, type LessonStop } from "../lesson";

const KEY = "hg-lesson";
/**
 * The lesson as this page knows it: storage may be blocked (a private window), and then
 * the lesson still lives as long as the page, across the cards it opens.
 */
let memory: LessonStop[] | null = null;

/** The places picked for a lesson, kept in this browser until the lesson is cleared. */
export function readPicked(): LessonStop[] {
  if (memory) return memory;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    memory = Array.isArray(v)
      ? v.filter(
          (x): x is LessonStop =>
            typeof (x as LessonStop | null)?.id === "string" &&
            ["number", "undefined"].includes(typeof (x as LessonStop).year),
        )
      : [];
  } catch {
    memory = [];
  }
  return memory;
}
/** The lesson's name, kept as its places are. */
let memoryTitle: string | null = null;
export function readTitle(): string {
  if (memoryTitle === null)
    try {
      memoryTitle = localStorage.getItem(`${KEY}-title`) ?? "";
    } catch {
      memoryTitle = "";
    }
  return memoryTitle;
}
function writeTitle(title: string): void {
  memoryTitle = title;
  try {
    if (title) localStorage.setItem(`${KEY}-title`, title);
    else localStorage.removeItem(`${KEY}-title`);
  } catch {
    // Storage blocked: `memoryTitle` keeps it for this visit.
  }
}
function writePicked(ids: readonly LessonStop[]): void {
  memory = [...ids];
  try {
    if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: `memory` keeps the lesson for this visit.
  }
}

/**
 * The lesson shared by every view of it (the place card's button, the lesson tool): one
 * store, so a place added in one shows in the other at once.
 */
const listeners = new Set<() => void>();
let snapshot: { picked: readonly LessonStop[]; title: string } | null = null;
const current = () => (snapshot ??= { picked: readPicked(), title: readTitle() });
function setLesson(picked: readonly LessonStop[], title: string): void {
  writePicked(picked);
  writeTitle(title);
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

/** "Add to a lesson" (Lucide list-plus), drawn here so the first chunk does not carry it. */
const ListPlus = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M11 12H3" />
    <path d="M16 6H3" />
    <path d="M16 18H3" />
    <path d="M18 9v6" />
    <path d="M21 12h-6" />
  </svg>
);

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

/** The card's header button: add this place to the lesson, or take it out. */
export function LessonToggle({
  lesson,
  onAdd,
}: {
  lesson: Lesson;
  /** After the place is added: the lesson tool opens on it. */
  onAdd?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const title = lesson.full
    ? t("lesson.full", { count: LESSON_MAX })
    : lesson.inLesson
      ? t("lesson.remove")
      : t("lesson.add");
  return (
    <button
      onClick={() => {
        const adding = !lesson.inLesson;
        lesson.toggle();
        if (adding) onAdd?.();
      }}
      // One name, its state in aria-pressed: "В урок, нажата" is the place in the lesson.
      aria-label={t("lesson.add")}
      title={title}
      aria-pressed={lesson.inLesson}
      disabled={lesson.full}
      className={`rounded-full p-1.5 enabled:hover:bg-paper-2 disabled:opacity-40 ${lesson.inLesson ? "bg-paper-2 text-accent" : "text-ink-soft enabled:hover:text-ink"}`}
    >
      <ListPlus />
    </button>
  );
}

/** Under the header while a lesson is being built: how many places, and what to do. */
export function LessonBar({ lesson, locale }: { lesson: Lesson; locale: Locale }) {
  const { t } = useTranslation();
  // The link copied, or shown to copy by hand when the clipboard refuses; for this lesson.
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const search = lessonSearch(lesson.picked, locale, lesson.title);
  const link = `${window.location.origin}${window.location.pathname}${search}`;
  const shown = copied?.key === search ? copied : null;
  const action =
    "text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid";
  if (lesson.undo)
    return (
      <div className="mx-5 mt-2 flex flex-wrap items-baseline gap-x-3 rounded-xl bg-accent/8 px-3 py-1.5 text-[13px] text-ink">
        <span role="status">{t("lesson.cleared")}</span>
        <button className={action} onClick={lesson.undo}>
          {t("lesson.undo")}
        </button>
      </div>
    );
  const n = lesson.picked.length;
  return (
    <div className="mx-5 mt-2 rounded-xl bg-accent/8 px-3 py-1.5 text-[13px] text-ink">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span role="status" className="font-medium">
          {t("lesson.count", { count: n })}
        </span>
        {n >= 2 && (
          <a href={search} className={action}>
            {t("lesson.start")}
          </a>
        )}
        {n >= 2 && (
          <button
            className={action}
            onClick={() => {
              navigator.clipboard.writeText(link).then(
                () => {
                  setCopied({ key: search, ok: true });
                },
                () => {
                  setCopied({ key: search, ok: false });
                },
              );
            }}
          >
            {shown?.ok ? t("lesson.copied") : t("lesson.copy")}
          </button>
        )}
        <button
          // At the end of the row, apart from the ways forward: it takes the lesson away.
          className="ml-auto text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
          onClick={lesson.clear}
        >
          {t("lesson.clear")}
        </button>
      </div>
      {n >= 2 && (
        // The lesson's name: the title of its tour and of the printed sheet.
        <input
          value={lesson.title}
          maxLength={TITLE_MAX}
          onChange={(e) => {
            lesson.setTitle(e.target.value);
          }}
          placeholder={t("lesson.title")}
          aria-label={t("lesson.title")}
          className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-[13px] placeholder:text-ink-soft/70"
        />
      )}
      <p className="mt-0.5 text-[12px] text-ink-soft">
        {n < 2 ? t("lesson.more") : t("lesson.year_hint")}
      </p>
      {shown && !shown.ok && (
        // The clipboard refused (a frame, no permission): the link to copy by hand.
        <input
          readOnly
          value={link}
          aria-label={t("lesson.copy")}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1 text-[12px]"
        />
      )}
    </div>
  );
}
