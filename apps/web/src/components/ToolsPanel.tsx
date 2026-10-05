import type { Locale } from "@hg/model";
import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import { distanceKm, roundKm, walkTime } from "../distance";
import { LessonBar, removeFromLesson, useLesson, useLessonStore } from "./LessonRow";
import { Panel } from "./Panel";
import { ArrowLeft, CircleHelp, ListPlus, Printer, Ruler, X } from "./icons";

export type Tool = "menu" | "measure" | "lesson" | "quiz";

interface End {
  readonly name: string;
  readonly at: readonly [number, number];
}

/**
 * The tools, each a few steps spelled out: the distance between two places, a lesson built
 * from the places opened, a quiz on a tour. One open at a time; the map stays in use, and
 * a place opened on it is the tool's next step.
 */
export function ToolsPanel({
  tool,
  onTool,
  onClose,
  locale,
  year,
  measure,
  placeName,
  tours,
  onQuiz,
  compact = false,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  onClose: () => void;
  locale: Locale;
  year: number;
  measure: { readonly from: End | null; readonly to: End | null; readonly onReset: () => void };
  /** A place's name by its id, in the reader's language. */
  placeName: (id: string) => string;
  /** The tours a quiz can be made on, with their titles. */
  tours: readonly { readonly id: string; readonly title: string }[];
  /** The quiz on a tour: on screen or printed for a class. */
  onQuiz: (tour: string, print: boolean) => void;
  /** A phone with a card open: one line, so the card and the map stay in reach. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (compact && (tool === "measure" || tool === "lesson"))
    return (
      <Panel className="flex items-center gap-2 py-1.5 pr-1.5 pl-3.5 max-md:w-full">
        <span className="text-accent">
          {tool === "measure" ? <Ruler className="size-4" /> : <ListPlus className="size-4" />}
        </span>
        <span role="status" className="flex-1 text-[13.5px] leading-snug text-ink">
          {tool === "measure" ? <MeasureLine {...measure} /> : <LessonLine />}
        </span>
        <button
          onClick={onClose}
          aria-label={t("tools.close")}
          title={t("tools.close")}
          className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </Panel>
    );
  const heading = tool === "menu" ? t("tools.title") : t(`tools.${tool}`);
  return (
    <Panel className="w-[360px] max-md:w-full">
      <div className="flex items-center gap-1 py-1.5 pr-1.5 pl-2">
        {tool !== "menu" ? (
          <button
            onClick={() => {
              onTool("menu");
            }}
            aria-label={t("tools.back")}
            title={t("tools.back")}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : (
          <span className="w-1.5" />
        )}
        <h2 className="flex-1 font-serif text-[16px] text-ink">{heading}</h2>
        <button
          onClick={onClose}
          aria-label={t("tools.close")}
          title={t("tools.close")}
          className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-4 pb-4">
        {tool === "menu" && <Menu onTool={onTool} />}
        {tool === "measure" && <Measure {...measure} />}
        {tool === "lesson" && <Lesson locale={locale} year={year} placeName={placeName} />}
        {tool === "quiz" && <Quiz tours={tours} onQuiz={onQuiz} />}
      </div>
    </Panel>
  );
}

/** The distance in a line: the step to take, or the answer. */
function MeasureLine({ from, to }: { from: End | null; to: End | null }) {
  const { t } = useTranslation();
  if (!from) return t("tools.measure_first");
  if (!to) return `${from.name}: ${t("tools.measure_second").toLowerCase()}`;
  const km = distanceKm(from.at, to.at);
  return `${from.name} → ${to.name}: ${t("tools.km", { km: roundKm(km) })}`;
}

function LessonLine() {
  const { t } = useTranslation();
  const n = useLessonStore().picked.length;
  return n ? t("lesson.count", { count: n }) : t("tools.lesson_pick");
}

function Menu({ onTool }: { onTool: (tool: Tool) => void }) {
  const { t } = useTranslation();
  const items = [
    { id: "measure", icon: <Ruler className="size-5" /> },
    { id: "lesson", icon: <ListPlus className="size-5" /> },
    { id: "quiz", icon: <CircleHelp className="size-5" /> },
  ] as const;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it.id}>
          <button
            onClick={() => {
              onTool(it.id);
            }}
            className="flex w-full items-start gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-paper-2"
          >
            <span className="mt-0.5 text-accent">{it.icon}</span>
            <span>
              <span className="block text-[14.5px] font-medium text-ink">
                {t(`tools.${it.id}`)}
              </span>
              <span className="block text-[13px] leading-snug text-ink-soft">
                {t(`tools.${it.id}_about`)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A step: its number, what to do, and whether it is done. */
function Step({ n, done, children }: { n: number; done: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-baseline gap-2.5 ${done ? "text-ink-soft" : "text-ink"}`}>
      <span
        className={`grid size-5 shrink-0 translate-y-[-1px] place-items-center rounded-full text-[11.5px] font-semibold tabular-nums ${done ? "bg-accent/15 text-accent" : "bg-accent text-paper"}`}
      >
        {n}
      </span>
      <span className="text-[14px] leading-snug">{children}</span>
    </li>
  );
}

function Measure({ from, to, onReset }: { from: End | null; to: End | null; onReset: () => void }) {
  const { t } = useTranslation();
  const km = from && to ? distanceKm(from.at, to.at) : null;
  const w = km === null ? null : walkTime(km);
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2" aria-live="polite">
        <Step n={1} done={from !== null}>
          {from ? <b className="font-medium">{from.name}</b> : t("tools.measure_first")}
        </Step>
        <Step n={2} done={to !== null}>
          {to ? <b className="font-medium">{to.name}</b> : t("tools.measure_second")}
        </Step>
      </ol>
      {km !== null && w && (
        <div className="rounded-xl bg-accent/8 px-3 py-2.5">
          <div className="font-serif text-[22px] leading-tight text-ink tabular-nums">
            {t("tools.km", { km: roundKm(km) })}
          </div>
          <div className="text-[13px] text-ink-soft">
            {t("tools.measure_walk", {
              walk:
                "hours" in w
                  ? t("place.walk_hours", { n: w.hours })
                  : t("place.walk_days", { count: w.days }),
            })}
          </div>
        </div>
      )}
      {to && <p className="text-[13px] leading-snug text-ink-soft">{t("tools.measure_next")}</p>}
      {from && (
        <button
          onClick={onReset}
          className="self-start text-[13.5px] text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {t("tools.measure_reset")}
        </button>
      )}
    </div>
  );
}

function Lesson({
  locale,
  year,
  placeName,
}: {
  locale: Locale;
  year: number;
  placeName: (id: string) => string;
}) {
  const { t } = useTranslation();
  // Not one place's: the panel's own view of the lesson.
  const lesson = useLesson("", year);
  const n = lesson.picked.length;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        <Step n={1} done={n >= 2}>
          {t("tools.lesson_pick")}
        </Step>
        <Step n={2} done={false}>
          {t("tools.lesson_share")}
        </Step>
      </ol>
      {n > 0 && (
        <ol className="flex max-h-[38vh] flex-col overflow-y-auto rounded-xl border border-line">
          {lesson.picked.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-2 border-line px-3 py-1.5 text-[14px] not-last:border-b"
            >
              <span className="w-5 text-[12px] text-ink-soft tabular-nums">{i + 1}</span>
              <span className="flex-1 text-ink">{placeName(s.id)}</span>
              <button
                onClick={() => {
                  removeFromLesson(s.id);
                }}
                aria-label={`${t("lesson.remove")}: ${placeName(s.id)}`}
                title={t("lesson.remove")}
                className="rounded-full p-1 text-ink-soft hover:bg-paper-2 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {(n > 0 || lesson.undo) && (
        <div className="-mx-5">
          <LessonBar lesson={lesson} locale={locale} />
        </div>
      )}
    </div>
  );
}

function Quiz({
  tours,
  onQuiz,
}: {
  tours: readonly { readonly id: string; readonly title: string }[];
  onQuiz: (tour: string, print: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] leading-snug text-ink">{t("tools.quiz_pick")}</p>
      <ul className="flex max-h-[46vh] flex-col overflow-y-auto rounded-xl border border-line">
        {tours.map((tour) => (
          <li
            key={tour.id}
            className="flex items-center gap-1 border-line py-1 pr-1.5 pl-3 not-last:border-b"
          >
            <button
              onClick={() => {
                onQuiz(tour.id, false);
              }}
              className="flex-1 py-1 text-left text-[14px] text-ink hover:text-accent"
            >
              {tour.title}
            </button>
            <button
              onClick={() => {
                onQuiz(tour.id, true);
              }}
              aria-label={`${t("tools.quiz_print")}: ${tour.title}`}
              title={t("tools.quiz_print")}
              className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
            >
              <Printer className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
