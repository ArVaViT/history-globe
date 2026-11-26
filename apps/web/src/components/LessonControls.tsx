// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import type { Locale } from "@hg/model";
import { useState } from "react";
import { useTranslation } from "../i18n";
import { LESSON_MAX, lessonSearch, TITLE_MAX } from "../lesson";
import type { Lesson } from "../lesson-store";
import { ListPlus } from "./icons";

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
      <ListPlus className="size-[18px]" />
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
  if (lesson.undo)
    return (
      <div className="mx-5 mt-2 flex flex-wrap items-baseline gap-x-3 rounded-xl bg-accent/8 px-3 py-1.5 text-[13px] text-ink">
        <span role="status">{t("lesson.cleared")}</span>
        <button className="link-accent" onClick={lesson.undo}>
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
          <a href={search} className="link-accent">
            {t("lesson.start")}
          </a>
        )}
        {n >= 2 && (
          <button
            className="link-accent"
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
          className="ml-auto text-ink-soft link-soft"
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
