import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import { formatYear, PERIODS, periodAt, type Locale } from "@hg/model";
import { ChevronsLeft, ChevronsRight, Pause, Play } from "./icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { Panel } from "./Panel";

const SPAN = YEAR_MAX - YEAR_MIN;
const BAND_COLORS = [
  "#d9c7a0",
  "#cdb07f",
  "#c79f78",
  "#b98d6a",
  "#ae8a74",
  "#a38581",
  "#8f8a92",
  "#7d8fa0",
  "#7f9a93",
  "#8aa184",
  "#a0a276",
  "#b6a472",
];
/** The narrowest window the slider zooms to, in years. */
const MIN_SPAN = 20;
/** Steps for the labelled ticks, from fine to coarse. */
const STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500];

export interface TimeView {
  readonly from: number;
  readonly to: number;
}

export const FULL_VIEW: TimeView = { from: YEAR_MIN, to: YEAR_MAX };

/** A window of `span` years around `at`, kept inside the slider's range. */
export function clampView(from: number, span: number): TimeView {
  const s = Math.min(Math.max(span, MIN_SPAN), SPAN);
  // Fractional: slow pans and gentle pinches add up instead of rounding away.
  const f = Math.min(Math.max(from, YEAR_MIN), YEAR_MAX - s);
  return { from: f, to: f + s };
}

/** Zoom by `factor` (below 1 zooms in) keeping the year `at` under the pointer. */
export function zoomView(v: TimeView, factor: number, at: number): TimeView {
  const span = v.to - v.from;
  const next = Math.min(Math.max(span * factor, MIN_SPAN), SPAN);
  return clampView(at - ((at - v.from) * next) / span, next);
}

/**
 * Round years to label in a window: the finest step that gives at most six ticks (a
 * label such as "970 г. до н. э." is wide), counted in the years as written (500 BC,
 * AD 100), as astronomical years.
 */
export function ticksFor(v: TimeView): number[] {
  const span = v.to - v.from;
  const step = STEPS.find((s) => span / s <= 6) ?? 500;
  const out: number[] = [];
  for (let y = Math.ceil(v.from); y <= v.to; y++) {
    const written = y <= 0 ? 1 - y : y;
    if (written % step === 0) out.push(y);
  }
  return out;
}

/** "1000 BC – 831 BC": the first and the last year of a half-open range. */
export function formatPeriodRange(range: { from: number; to: number }, locale: Locale): string {
  return `${formatYear(range.from, locale)} – ${formatYear(range.to - 1, locale)}`;
}

/** A dated event on the slider: a town founded, destroyed, rebuilt. */
export interface TimelineEvent {
  readonly year: number;
  readonly label: string;
  /** "c." in the source: shown as such. */
  readonly approximate?: boolean;
  /** A turning point of the history (events.yaml), drawn taller and in gold. */
  readonly major?: boolean;
}

export function Timeline({
  year,
  locale,
  playing,
  speed,
  events = [],
  onYear,
  onPlay,
  onSpeed,
}: {
  year: number;
  locale: Locale;
  playing: boolean;
  speed: number;
  events?: readonly TimelineEvent[];
  onYear: (year: number) => void;
  onPlay: () => void;
  onSpeed: () => void;
}) {
  const { t } = useTranslation();
  const period = periodAt(year);
  const ru = locale === "ru";
  const [view, setView] = useState<TimeView>(FULL_VIEW);
  const span = view.to - view.from;
  const zoomed = span < SPAN;
  const pct = (y: number) => ((y - view.from) / span) * 100;
  // The era band under the pointer: the slider covers the bands, so native titles never show.
  const [hover, setHover] = useState<{ x: number; year: number } | null>(null);
  const hovered = hover ? periodAt(hover.year) : undefined;
  // Events within about 1 % of the slider of the pointer are named in the tip.
  const near = hover
    ? events.filter((e) => Math.abs(e.year - hover.year) <= Math.max(span / 100, 1)).slice(0, 3)
    : [];
  const periodName = period ? (ru ? period.name.ru : period.name.en) : "";
  const track = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);

  // The year leaves the window (playback, the buttons, a tour): the window follows it,
  // adjusted during render when the year changes, as React recommends over an effect.
  const [shownYear, setShownYear] = useState(year);
  if (year !== shownYear) {
    setShownYear(year);
    if (year < view.from || year > view.to) setView(clampView(year - span / 2, span));
  }

  // A trackpad pinch (a wheel event with ctrlKey) zooms around the pointer; two fingers
  // sideways, or a wheel when zoomed in, move the window. Native and not passive: React's
  // wheel listener cannot stop the page itself from zooming.
  useEffect(() => {
    const el = group.current;
    const bar = track.current;
    if (!el || !bar) return;
    const onWheel = (e: WheelEvent) => {
      const box = bar.getBoundingClientRect();
      // Lines (Firefox's mouse wheel) count as 16 px.
      const k = e.deltaMode === 1 ? 16 : 1;
      const frac = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
      // The tip named the year under the pointer before the move: it waits for the next.
      setHover(null);
      setView((v) => {
        const s = v.to - v.from;
        if (e.ctrlKey) return zoomView(v, Math.exp(e.deltaY * k * 0.01), v.from + frac * s);
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * k;
        if (s >= SPAN && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return v;
        return clampView(v.from + (d / box.width) * s, s);
      });
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const ticks = ticksFor(view);
  const inView = events.filter((e) => e.year >= view.from && e.year <= view.to);

  return (
    <Panel className="relative w-[min(920px,calc(100vw-760px))] min-w-[560px] px-5 pt-3 pb-3 max-xl:w-full max-xl:min-w-0 max-md:px-3 max-md:pt-2">
      {hovered && hover && (
        // Above the whole panel: inside it the tip covered the year and the era name.
        // Positioned on the panel, so it holds however tall the header grows.
        <div
          role="tooltip"
          style={{ left: `calc(1.25rem + (100% - 2.5rem) * ${String(hover.x / 100)})` }}
          className={`pointer-events-none absolute bottom-full mb-2 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-tight whitespace-nowrap text-paper shadow-lg ${hover.x < 15 ? "" : hover.x > 85 ? "-translate-x-full" : "-translate-x-1/2"}`}
        >
          <div className="font-medium">{ru ? hovered.name.ru : hovered.name.en}</div>
          <div className="text-paper/75 tabular-nums">
            {formatPeriodRange(hovered.range, locale)}
          </div>
          {near.map((e) => (
            <div key={`${String(e.year)}${e.label}`} className="mt-1 text-paper">
              <span className="text-gold tabular-nums">
                {e.approximate ? `${t("place.circa")} ` : ""}
                {formatYear(e.year, locale)}
              </span>{" "}
              · {e.label}
            </div>
          ))}
        </div>
      )}
      <div ref={group} role="group" aria-label={t("time.timeline")}>
        <div className="flex items-center gap-4 max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-1">
          <div className="min-w-[210px] font-serif text-[28px] leading-none font-semibold whitespace-nowrap text-ink tabular-nums max-xl:min-w-0 max-lg:flex-1 max-lg:text-[21px] max-md:text-[19px]">
            {formatYear(year, locale)}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug text-ink-soft max-lg:order-last max-lg:basis-full max-md:text-[11.5px]">
            <span>{periodName}</span>
            {period?.disputed && (
              <span className="rounded-full whitespace-nowrap bg-[#f4dfc9] px-2 py-0.5 text-[11px] text-[#7a4a1d]">
                {ru ? period.disputed.ru : period.disputed.en}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              label={t("time.back", { n: 100 })}
              onClick={() => {
                onYear(year - 100);
              }}
            >
              <ChevronsLeft className="size-4" aria-hidden />
            </IconButton>
            <button
              onClick={onPlay}
              aria-label={playing ? t("time.pause") : t("time.play")}
              title={playing ? t("time.pause") : t("time.play")}
              className="grid size-10 place-items-center rounded-full bg-accent text-paper shadow hover:brightness-110"
            >
              {playing ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Play className="size-4 translate-x-px" aria-hidden />
              )}
            </button>
            <IconButton
              label={t("time.forward", { n: 100 })}
              onClick={() => {
                onYear(year + 100);
              }}
            >
              <ChevronsRight className="size-4" aria-hidden />
            </IconButton>
            <button
              onClick={onSpeed}
              aria-label={`${t("time.speed")}: ${speedLabel(speed)}`}
              title={t("time.speed")}
              className="h-8 min-w-11 rounded-full px-2 text-[12.5px] font-semibold text-ink-soft tabular-nums ring-1 ring-line hover:bg-paper-2 hover:text-ink"
            >
              {speedLabel(speed)}
            </button>
          </div>
        </div>

        <div
          ref={track}
          className="relative mt-3 h-10 touch-pan-y"
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const frac = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
            setHover({ x: frac * 100, year: Math.round(view.from + frac * span) });
          }}
          onPointerLeave={() => {
            setHover(null);
          }}
        >
          <div aria-hidden className="absolute inset-x-0 top-1 h-3 overflow-hidden rounded-full">
            {PERIODS.map((p, i) => {
              const from = Math.max(p.range.from, view.from);
              const to = Math.min(p.range.to, view.to + 1);
              if (to <= from) return null;
              return (
                <div
                  key={p.id}
                  style={{
                    left: `${String(pct(from))}%`,
                    width: `${String(pct(to) - pct(from))}%`,
                    background: BAND_COLORS[i % BAND_COLORS.length],
                  }}
                  className={`absolute inset-y-0 ${p.id === period?.id ? "opacity-100" : "opacity-55"}`}
                />
              );
            })}
          </div>
          <input
            ref={range}
            type="range"
            min={Math.ceil(view.from)}
            max={Math.floor(view.to)}
            step={1}
            value={Math.min(Math.max(year, view.from), view.to)}
            onChange={(e) => {
              onYear(Number(e.target.value));
            }}
            aria-label={t("time.year")}
            aria-valuetext={
              periodName ? `${formatYear(year, locale)}, ${periodName}` : formatYear(year, locale)
            }
            // Zoomed away from the year, the thumb waits at the edge, faded.
            data-away={year < view.from || year > view.to ? "" : undefined}
            className="timeline-range absolute inset-x-0 top-0 h-5 w-full"
          />
          {[...inView]
            .sort((a, b) => Number(a.major ?? false) - Number(b.major ?? false))
            .map((e) => (
              <span
                key={`${String(e.year)}${e.label}`}
                aria-hidden
                style={{ left: `${String(pct(e.year))}%` }}
                className={`pointer-events-none absolute w-[2px] -translate-x-1/2 rounded-full ${e.major ? "top-[-1px] h-[22px] bg-gold" : "top-[3px] h-[14px] bg-ink/60"}`}
              />
            ))}
          {ticks.map((y, i) => {
            const x = pct(y);
            return (
              <span
                key={y}
                aria-hidden
                style={{ left: `${String(x)}%` }}
                className={`absolute top-6 text-[11px] whitespace-nowrap text-ink-soft ${x < 6 ? "" : x > 94 ? "-translate-x-full" : "-translate-x-1/2"} ${ticks.length > 3 && i % 2 === 1 ? "max-[1400px]:hidden" : ""}`}
              >
                {formatYear(y, locale)}
              </span>
            );
          })}
          {/* The turn of the era, marked but not labelled: its label would collide with AD 100. */}
          {view.from <= 1 && view.to >= 1 && (
            <span
              style={{ left: `${String(pct(1))}%` }}
              aria-hidden
              className="absolute top-0 h-5 w-px -translate-x-1/2 bg-ink/50"
            />
          )}
        </div>
        {zoomed && (
          <Overview
            view={view}
            locale={locale}
            year={year}
            onView={setView}
            onReset={() => {
              setView(FULL_VIEW);
              // The bar and its button go away: the focus moves to the slider, not the page.
              range.current?.focus();
            }}
            label={t("time.window")}
            resetLabel={t("time.zoom_out")}
          />
        )}
      </div>
    </Panel>
  );
}

function speedLabel(speed: number): string {
  return speed < 1 ? "½×" : `${String(speed)}×`;
}

/**
 * The whole range under a zoomed slider, with the shown window on it: drag the window,
 * or press elsewhere to move it there.
 */
function Overview({
  view,
  locale,
  year,
  onView,
  onReset,
  label,
  resetLabel,
}: {
  view: TimeView;
  locale: Locale;
  year: number;
  onView: (v: TimeView) => void;
  onReset: () => void;
  label: string;
  resetLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const span = view.to - view.from;
  const at = (y: number) => ((y - YEAR_MIN) / SPAN) * 100;
  const yearAt = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    return r ? YEAR_MIN + ((clientX - r.left) / r.width) * SPAN : view.from;
  };
  return (
    <div className="mt-1 flex items-center gap-2">
      <div
        ref={box}
        role="scrollbar"
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={YEAR_MIN}
        aria-valuemax={YEAR_MAX - span}
        aria-valuenow={Math.round(view.from)}
        aria-valuetext={`${formatYear(Math.round(view.from), locale)} – ${formatYear(Math.round(view.to), locale)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          const d = e.key === "ArrowLeft" ? -span / 4 : e.key === "ArrowRight" ? span / 4 : 0;
          if (!d) return;
          e.preventDefault();
          onView(clampView(view.from + d, span));
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const y = yearAt(e.clientX);
          const inside = y >= view.from && y <= view.to;
          const from = inside ? view.from : y - span / 2;
          if (!inside) onView(clampView(from, span));
          drag.current = { x: e.clientX, from: inside ? view.from : clampView(from, span).from };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const r = box.current?.getBoundingClientRect();
          if (!d || !r) return;
          onView(clampView(d.from + ((e.clientX - d.x) / r.width) * SPAN, span));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        className="relative h-3 flex-1 cursor-grab touch-none rounded-full bg-ink/10 active:cursor-grabbing"
      >
        <span
          aria-hidden
          style={{ left: `${String(at(year))}%` }}
          className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-accent"
        />
        <span
          aria-hidden
          style={{ left: `${String(at(view.from))}%`, width: `${String((span / SPAN) * 100)}%` }}
          className="absolute inset-y-0 min-w-2 rounded-full bg-ink/35 ring-1 ring-paper"
        />
      </div>
      <button
        onClick={onReset}
        className="rounded-full px-2 text-[11.5px] text-ink-soft hover:bg-paper-2 hover:text-ink"
      >
        {resetLabel}
      </button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
