import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import {
  formatYear,
  formatYearRange,
  PERIODS,
  periodAt,
  type Locale,
  type PlaceLife,
  parseYearInput,
  pick,
} from "@hg/model";
import { ChevronDown, ChevronLeft, ChevronRight, Ellipsis, Pause, Play } from "./icons";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { Panel } from "./Panel";

// The "…" menu's contents come with its first press (MoreMenuPanel.tsx).
const MoreMenuPanel = lazy(() =>
  import("./MoreMenuPanel").then((m) => ({ default: m.MoreMenuPanel })),
);

const SPAN = YEAR_MAX - YEAR_MIN;
/**
 * The ages named on the track: the eras grouped so that a name fits its band in either
 * language («Железный век IIB» did not, nor most Russian names); the era itself is in the
 * line above the track.
 */
const AGES: readonly { first: string; last: string; en: string; ru: string }[] = [
  { first: "eb1", last: "eb4", en: "Early Bronze", ru: "Ранняя бронза" },
  { first: "mb2", last: "mb2", en: "Middle Bronze", ru: "Средняя бронза" },
  { first: "lb", last: "lb", en: "Late Bronze", ru: "Поздняя бронза" },
  { first: "iron1", last: "iron2c", en: "Iron Age", ru: "Железный век" },
  { first: "babylonian", last: "babylonian", en: "Babylonian", ru: "Вавилон" },
  { first: "persian", last: "persian", en: "Persian", ru: "Персия" },
  { first: "hellenistic", last: "hasmonean", en: "Hellenistic", ru: "Эллинизм" },
  { first: "early-roman", last: "late-roman", en: "Roman", ru: "Рим" },
  { first: "byzantine", last: "byzantine", en: "Byzantine", ru: "Византия" },
  { first: "early-islamic", last: "mamluk", en: "Middle Ages", ru: "Средние века" },
];
const AGE_SPANS = AGES.flatMap((a) => {
  const from = PERIODS.find((p) => p.id === a.first)?.range.from;
  const to = PERIODS.find((p) => p.id === a.last)?.range.to;
  return from === undefined || to === undefined ? [] : [{ ...a, from, to }];
});

/** A name's width on the track, measured in the track's font once and kept. */
const widths = new Map<string, number>();
let pen: CanvasRenderingContext2D | null | undefined;
function labelWidth(name: string): number {
  const known = widths.get(name);
  if (known !== undefined) return known;
  if (pen === undefined) {
    pen = document.createElement("canvas").getContext("2d");
    if (pen) pen.font = `500 10.5px ${getComputedStyle(document.body).fontFamily}`;
  }
  const w = (pen ? pen.measureText(name).width : name.length * 6.4) + 12;
  widths.set(name, w);
  return w;
}

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
const STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];

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
 * AD 1000), as astronomical years.
 */
export function ticksFor(v: TimeView): number[] {
  const span = v.to - v.from;
  const step = STEPS.find((s) => span / s <= 6) ?? 500;
  const out: number[] = [];
  for (let y = Math.ceil(v.from); y <= v.to; y++) {
    const written = y <= 0 ? 1 - y : y;
    if (written % step === 0) out.push(y);
  }
  // The end of the range (AD 1300) is labelled when shown and clear of the last tick.
  const last = out.at(-1);
  if (v.to >= YEAR_MAX && (last === undefined || YEAR_MAX - last > span * 0.12)) {
    out.push(YEAR_MAX);
  }
  return out;
}

/** "1000–831 BC": the first and the last year of a half-open range. */
export function formatPeriodRange(range: { from: number; to: number }, locale: Locale): string {
  return formatYearRange(range.from, range.to - 1, locale);
}

/** A dated event on the slider: a town founded, destroyed, rebuilt. */
export interface TimelineEvent {
  readonly year: number;
  readonly label: string;
  /** "c." in the source: shown as such. */
  readonly approximate?: boolean;
  /** A turning point of the history (events.yaml), drawn taller and in gold. */
  readonly major?: boolean;
  /** The place it happened at, opened when its mark is pressed. */
  readonly place?: string;
  /** Or the ancient site, flown to. */
  readonly site?: { readonly lon: number; readonly lat: number; readonly rank?: number };
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
  onPicture,
  onPrint,
  onPrintBlank,
  onPrintQuiz,
  onQuiz,
  onEvent,
  life,
  scaleSlot,
  onCollapse,
}: {
  year: number;
  locale: Locale;
  playing: boolean;
  speed: number;
  events?: readonly TimelineEvent[];
  onYear: (year: number) => void;
  onPlay: () => void;
  onSpeed: (speed: number) => void;
  /** Save the map as it is now as a picture (a lesson, a sermon slide); none embedded. */
  onPicture?: (() => void) | undefined;
  /** Print the map with what it shows on an A4 sheet for a class; none embedded. */
  onPrint?: (() => void) | undefined;
  /** The outline map for a class, when a tour or a chapter is shown. */
  onPrintBlank?: (() => void) | undefined;
  onPrintQuiz?: (() => void) | undefined;
  onQuiz?: (() => void) | undefined;
  /** A mark pressed: its year, and its place opened. Keyboard users have the events tab. */
  onEvent?: (event: TimelineEvent) => void;
  /** The open place's years (founded, destroyed, in ruins), drawn under the band. */
  life?: { readonly name: string; readonly life: PlaceLife } | undefined;
  /** Where the map's own controls go: the scale, the zoom and compass, the (i). */
  scaleSlot?: ((el: HTMLDivElement | null) => void) | undefined;
  /** Embedded: fold the player back to a line, leaving the frame to the map. */
  onCollapse?: (() => void) | undefined;
}) {
  // How opaque the player is, set from its "⋯" and remembered: the map shows through.
  const [alpha, setAlpha] = useState(readAlpha);
  const { t } = useTranslation();
  const period = periodAt(year);
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
  const periodName = period ? (pick(period.name, locale) ?? "") : "";
  const track = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  // The track's width in pixels: which era names fit inside their bands.
  const [trackWidth, setTrackWidth] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setTrackWidth(el.offsetWidth);
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, []);

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

  // The whole range on a narrow slider: its two ends; on a laptop's, three thousands two
  // thousand years apart. Every other thousand hidden had left the right half bare, as
  // if the slider were cut off.
  const ticks =
    zoomed || trackWidth === 0
      ? ticksFor(view)
      : trackWidth < 600
        ? [YEAR_MIN, YEAR_MAX]
        : trackWidth < 1300
          ? [-2999, -999, 1000]
          : ticksFor(view);
  const inView = events.filter((e) => e.year >= view.from && e.year <= view.to);
  const majors = inView.filter((e) => e.major);

  return (
    <Panel
      className="relative w-full px-6 pt-3.5 pb-3 max-md:px-3 max-md:pt-2"
      style={{
        backgroundColor: `rgb(246 239 225 / ${String(alpha)})`,
        // Fully see-through glass would blur the map it is meant to show.
        backdropFilter: alpha < 0.6 ? "none" : undefined,
      }}
    >
      {hovered && hover && (
        // Above the whole panel: inside it the tip covered the year and the era name.
        // Positioned on the panel, so it holds however tall the header grows.
        <div
          role="tooltip"
          style={{ left: `calc(1.5rem + (100% - 3rem) * ${String(hover.x / 100)})` }}
          className={`pointer-events-none absolute bottom-full mb-2 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-tight whitespace-nowrap text-paper shadow-lg ${hover.x < 15 ? "" : hover.x > 85 ? "-translate-x-full" : "-translate-x-1/2"}`}
        >
          <div className="font-medium">{pick(hovered.name, locale) ?? ""}</div>
          <div className="text-paper/75 tabular-nums">
            {formatPeriodRange(hovered.range, locale)}
          </div>
          {hovered.disputed && (
            <div className="mt-0.5 text-gold">{pick(hovered.disputed, locale) ?? ""}</div>
          )}
          {!zoomed && <div className="mt-1 text-paper/60">{t("time.zoom_hint")}</div>}
          {near.map((e) => (
            <div key={`${String(e.year)}${e.label}${e.place ?? ""}`} className="mt-1 text-paper">
              <span className="text-gold tabular-nums">
                {e.approximate ? `${t("place.circa")} ` : ""}
                {formatYear(e.year, locale)}
              </span>{" "}
              · {e.label}
            </div>
          ))}
        </div>
      )}
      {onCollapse && (
        // A small tab on the panel's top edge, in the middle: out of the controls' way.
        <button
          onClick={onCollapse}
          aria-expanded
          aria-label={t("time.collapse")}
          title={t("time.collapse")}
          className="group absolute top-0 left-1/2 z-10 grid h-4 w-12 -translate-x-1/2 place-items-center rounded-b-lg text-ink-soft/50 transition hover:text-ink focus-visible:text-ink"
        >
          <ChevronDown
            className="size-3.5 transition-transform duration-150 group-hover:scale-[1.35]"
            aria-hidden
          />
        </button>
      )}
      <div ref={group} role="group" aria-label={t("time.timeline")}>
        <div className="flex items-center gap-4 max-xl:flex-wrap max-xl:gap-x-3 max-xl:gap-y-1 max-md:gap-x-2">
          <YearField year={year} locale={locale} onYear={onYear} />
          <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug text-ink-soft max-xl:order-last max-xl:basis-full max-md:text-[11.5px]">
            {/* The era's name and years are in the tip over the band: here only the key to
                the line under it, when a place's years are drawn. */}
            {life && (
              // The key to the line under the band: whose years it shows.
              <span className="inline-flex items-center gap-1.5 text-ink-soft">
                <span className="h-[5px] w-4 rounded-full bg-accent/70" aria-hidden />
                {t("time.life_of", { name: life.name })}
              </span>
            )}
          </div>
          {scaleSlot && <div ref={scaleSlot} className="hg-map-slot flex items-center gap-2" />}
          <div className="flex items-center gap-1 max-md:gap-0.5">
            <YearStep
              label={t("time.back", { n: 100 })}
              dir="back"
              onClick={() => {
                onYear(year - 100);
              }}
            />
            <button
              onClick={onPlay}
              aria-label={playing ? t("time.pause") : t("time.play")}
              title={playing ? t("time.pause") : t("time.play")}
              className="grid size-10 place-items-center rounded-full bg-accent text-paper transition hover:brightness-110 active:scale-95 max-md:size-9"
            >
              {playing ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Play className="size-4 translate-x-px" aria-hidden />
              )}
            </button>
            <YearStep
              label={t("time.forward", { n: 100 })}
              dir="forward"
              onClick={() => {
                onYear(year + 100);
              }}
            />
            <MoreMenu
              speed={speed}
              onSpeed={onSpeed}
              onPicture={onPicture}
              onPrint={onPrint}
              onPrintBlank={onPrintBlank}
              onPrintQuiz={onPrintQuiz}
              onQuiz={onQuiz}
              alpha={alpha}
              onAlpha={(a) => {
                setAlpha(a);
                writeAlpha(a);
              }}
            />
          </div>
        </div>

        <div
          ref={track}
          className={`relative mt-3 touch-pan-y select-none ${life ? "h-[68px]" : "h-[60px]"}`}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const frac = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
            setHover({ x: frac * 100, year: Math.round(view.from + frac * span) });
          }}
          onPointerLeave={() => {
            setHover(null);
          }}
          // A double click zooms to the era under the pointer; on a zoomed slider, back out.
          onDoubleClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const at = view.from + ((e.clientX - box.left) / box.width) * span;
            const era = periodAt(Math.round(at));
            if (!era || zoomed) {
              setView(FULL_VIEW);
              return;
            }
            const pad = (era.range.to - era.range.from) * 0.08;
            setView(clampView(era.range.from - pad, era.range.to - era.range.from + 2 * pad));
          }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-3 h-[22px] overflow-hidden rounded-full"
          >
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
                  className={`absolute inset-y-0 ${p.id === period?.id ? "opacity-100" : "opacity-60"}`}
                />
              );
            })}
            {(() => {
              // Each age's name in its band, where the band holds it; moved aside from the
              // thumb when that sits on it, and left out when there is no room aside.
              const thumb = (pct(Math.min(Math.max(year, view.from), view.to)) / 100) * trackWidth;
              const placed = AGE_SPANS.flatMap((a) => {
                const from = Math.max(a.from, view.from);
                const to = Math.min(a.to, view.to + 1);
                if (to <= from) return [];
                const name = pick({ en: a.en, ru: a.ru }, locale) ?? a.en;
                const x0 = (pct(from) / 100) * trackWidth;
                const x1 = (pct(to) / 100) * trackWidth;
                const w = labelWidth(name);
                let left = (x0 + x1) / 2 - w / 2;
                if (thumb + 12 > left && thumb - 12 < left + w)
                  left =
                    thumb + 13 + w <= x1 ? thumb + 13 : thumb - 13 - w >= x0 ? thumb - 13 - w : NaN;
                return x1 - x0 < w || Number.isNaN(left) ? [] : [{ name, left, w }];
              });
              // One or two names alone read as the name of the whole track: none then.
              return placed.length < 3
                ? null
                : placed.map(({ name, left, w }) => (
                    <span
                      key={name}
                      style={{ left: `${String(left)}px`, width: `${String(w)}px` }}
                      className="pointer-events-none absolute inset-y-0 flex items-center justify-center text-[10.5px] font-medium whitespace-nowrap text-ink/80"
                    >
                      {name}
                    </span>
                  ));
            })()}
          </div>
          <input
            ref={range}
            type="range"
            min={Math.ceil(view.from)}
            max={Math.floor(view.to)}
            step={1}
            value={Math.min(Math.max(year, view.from), view.to)}
            onChange={(e) => {
              const v = Number(e.target.value);
              // Dragged by hand, the thumb settles on the nearest turning point within six
              // pixels: a key year is easy to hit, and every other year still is. From the
              // keyboard every year stays reachable.
              if (dragging.current) {
                const reach = (span * 6) / Math.max(trackWidth, 1);
                let snap: TimelineEvent | undefined;
                for (const ev of majors) {
                  const d = Math.abs(ev.year - v);
                  if (d <= reach && (!snap || d < Math.abs(snap.year - v))) snap = ev;
                }
                if (snap) {
                  onYear(snap.year);
                  return;
                }
              }
              onYear(v);
            }}
            onPointerDown={() => {
              dragging.current = true;
              // Released anywhere, over the slider or not: back to exact years.
              const release = () => {
                dragging.current = false;
              };
              window.addEventListener("pointerup", release, { once: true });
              window.addEventListener("pointercancel", release, { once: true });
            }}
            // From the keyboard, + and − zoom around the year, as a pinch does.
            onKeyDown={(e) => {
              // Cmd/Ctrl with + or − is the browser's own zoom: left to it.
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              const f = e.key === "+" || e.key === "=" ? 0.5 : e.key === "-" ? 2 : 0;
              if (!f) return;
              e.preventDefault();
              setView((v) => zoomView(v, f, year));
            }}
            aria-keyshortcuts="Plus = -"
            aria-label={t("time.year")}
            aria-valuetext={
              periodName ? `${formatYear(year, locale)}, ${periodName}` : formatYear(year, locale)
            }
            // Zoomed away from the year, the thumb waits at the edge, faded.
            data-away={year < view.from || year > view.to ? "" : undefined}
            className="timeline-range absolute inset-x-0 top-[11px] h-6 w-full"
          />
          {onEvent && inView.length > 0 && (
            // The strip of marks above the band: a press takes the nearest mark (within
            // 6 px) to its year and opens its place.
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[11px] cursor-pointer"
              onClick={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - box.left;
                let best: TimelineEvent | undefined;
                let bestD = 7;
                for (const ev of inView) {
                  const d = Math.abs((pct(ev.year) / 100) * box.width - x);
                  if (d < bestD || (d === bestD && ev.major)) {
                    best = ev;
                    bestD = d;
                  }
                }
                if (best) onEvent(best);
              }}
            />
          )}
          {[...inView]
            .sort((a, b) => Number(a.major ?? false) - Number(b.major ?? false))
            .map((e) => (
              <span
                key={`${String(e.year)}${e.label}${e.place ?? ""}`}
                aria-hidden
                style={{ left: `${String(pct(e.year))}%` }}
                className={`pointer-events-none absolute w-[2px] -translate-x-1/2 rounded-full ${e.major ? "top-0 h-[10px] bg-gold" : "top-[4px] h-[6px] bg-ink/45"}`}
              />
            ))}
          {ticks.map((y, i) => {
            const x = pct(y);
            return (
              <span
                key={y}
                aria-hidden
                style={{ left: `${String(x)}%` }}
                className={`absolute ${life ? "top-[46px]" : "top-[38px]"} text-[11.5px] whitespace-nowrap text-ink-soft ${x < 6 ? "" : x > 94 ? "-translate-x-full" : "-translate-x-1/2"} ${ticks.length > 3 && i % 2 === 1 && y !== YEAR_MAX ? "max-[1400px]:hidden" : ""}`}
              >
                {formatYear(y, locale)}
              </span>
            );
          })}
          {life && <LifeLine life={life.life} pct={pct} view={view} />}
          {/* The turn of the era, marked but not labelled: its label would collide with the ticks around it. */}
          {view.from <= 1 && view.to >= 1 && (
            <span
              style={{ left: `${String(pct(1))}%` }}
              aria-hidden
              className="absolute top-3 h-[22px] w-px -translate-x-1/2 bg-ink/50"
            />
          )}
        </div>
        {/* Always there, zoomed or not: the bar coming and going moved everything below. */}
        {
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
            zoomed={zoomed}
          />
        }
      </div>
    </Panel>
  );
}

function speedLabel(speed: number): string {
  return speed < 1 ? "½×" : `${String(speed)}×`;
}

function readAlpha(): number {
  try {
    const v = Number(localStorage.getItem("hg:player-alpha"));
    return v >= 0.3 && v <= 1 ? v : 0.9;
  } catch {
    return 0.9;
  }
}

function writeAlpha(a: number): void {
  try {
    localStorage.setItem("hg:player-alpha", String(a));
  } catch {
    // Storage refused: the player keeps the look for this visit only.
  }
}

/**
 * When the open place stood, under the era band: a line from its founding to its end,
 * broken where it lay in ruins. Open-ended where the record gives no year.
 */
function LifeLine({
  life,
  pct,
  view,
}: {
  life: PlaceLife;
  pct: (year: number) => number;
  view: TimeView;
}) {
  const from = life.from?.year ?? YEAR_MIN;
  const until = life.until?.year ?? YEAR_MAX;
  const parts = life.gap
    ? [
        [from, life.gap.from.year],
        [life.gap.until.year + 1, until],
      ]
    : [[from, until]];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[38px] h-[5px]">
      {parts.map(([a = 0, b = 0]) => {
        const l = Math.max(a, view.from);
        const r = Math.min(b, view.to);
        if (r <= l) return null;
        return (
          <span
            key={a}
            style={{ left: `${String(pct(l))}%`, width: `${String(pct(r) - pct(l))}%` }}
            className="absolute inset-y-0 rounded-full bg-accent/70"
          />
        );
      })}
    </div>
  );
}

/**
 * The year in large type; pressed, it becomes a field: type "586 до н. э." or "30" and
 * Enter to go there, Esc to leave it as it was.
 */
function YearField({
  year,
  locale,
  onYear,
}: {
  year: number;
  locale: Locale;
  onYear: (year: number) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  // Closing the field gives the focus back to the year it opened from.
  const yearButton = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!editing && refocus.current) {
      yearButton.current?.focus();
      refocus.current = false;
    }
  }, [editing]);
  const shown = formatYear(year, locale);
  const big =
    "min-w-[210px] font-serif text-[28px] leading-none font-semibold whitespace-nowrap text-ink tabular-nums max-xl:min-w-0 max-xl:flex-1 max-lg:text-[21px] max-md:text-[15px]";
  if (!editing)
    return (
      <button
        ref={yearButton}
        onClick={() => {
          setText(shown);
          setBad(false);
          setEditing(true);
        }}
        title={t("time.go_to")}
        aria-label={`${shown.replace(/\.$/, "")}. ${t("time.go_to")}`}
        className={`${big} -mx-1.5 rounded-lg px-1.5 py-0.5 text-left hover:bg-paper-2`}
      >
        {shown}
      </button>
    );
  return (
    <form
      className="max-xl:min-w-0 max-xl:flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        const y = parseYearInput(text);
        if (y === null || y < YEAR_MIN || y > YEAR_MAX) {
          setBad(true);
          return;
        }
        onYear(y);
        refocus.current = true;
        setEditing(false);
      }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setBad(false);
        }}
        onFocus={(e) => {
          e.currentTarget.select();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            refocus.current = true;
            setEditing(false);
          }
        }}
        onBlur={() => {
          setEditing(false);
        }}
        aria-label={t("time.go_to")}
        aria-invalid={bad}
        aria-describedby="year-hint"
        className={`w-[230px] rounded-lg bg-white/80 px-2 py-1 font-serif text-[22px] font-semibold text-ink ring-1 outline-none max-md:w-full max-md:text-[17px] ${bad ? "ring-[#b4442f]" : "ring-line focus:ring-accent"}`}
      />
      <div
        id="year-hint"
        className={`mt-1 text-[11px] ${bad ? "text-[#b4442f]" : "text-ink-soft"}`}
      >
        {bad ? t("time.go_to_bad") : t("time.go_to_hint")}
      </div>
    </form>
  );
}

/**
 * The player's "⋯": the speed, full screen (for a projector) and the map saved as a
 * picture. Closes on a pick, on Esc or on a press outside; Esc gives the focus back.
 */
function MoreMenu({
  speed,
  onSpeed,
  onPicture,
  onPrint,
  onPrintBlank,
  onPrintQuiz,
  onQuiz,
  alpha,
  onAlpha,
}: {
  speed: number;
  onSpeed: (speed: number) => void;
  alpha: number;
  onAlpha: (alpha: number) => void;
  onPicture?: (() => void) | undefined;
  onPrint?: (() => void) | undefined;
  /** The outline map for a class, when a tour or a chapter is shown. */
  onPrintBlank?: (() => void) | undefined;
  onPrintQuiz?: (() => void) | undefined;
  onQuiz?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc closes the menu only: not the open card or tour behind it too.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div
      ref={box}
      className="relative"
      // Tabbing out of the menu closes it, as a press outside does.
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={button}
        onClick={() => {
          setOpen(!open);
        }}
        aria-label={t("time.more")}
        title={t("time.more")}
        aria-expanded={open}
        aria-controls={open ? "player-more" : undefined}
        className={`grid size-8 place-items-center rounded-full hover:bg-paper-2 hover:text-ink ${open ? "bg-paper-2 text-ink" : "text-ink-soft"}`}
      >
        <Ellipsis className="size-5" aria-hidden />
        {speed !== 1 && (
          // A speed other than 1× shows on the closed button: playback is not as usual.
          <span className="absolute -top-1 -right-1 rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-paper tabular-nums">
            {speedLabel(speed)}
          </span>
        )}
      </button>
      {open && (
        // Its code failing to load closes nothing but the menu.
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <MoreMenuPanel
              speed={speed}
              onSpeed={onSpeed}
              alpha={alpha}
              onAlpha={onAlpha}
              onPicture={onPicture}
              onPrint={onPrint}
              onPrintBlank={onPrintBlank}
              onPrintQuiz={onPrintQuiz}
              onQuiz={onQuiz}
              close={() => {
                setOpen(false);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
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
  zoomed,
}: {
  view: TimeView;
  locale: Locale;
  year: number;
  onView: (v: TimeView) => void;
  onReset: () => void;
  label: string;
  resetLabel: string;
  /** Not zoomed, the window is the whole range and there is nothing to reset. */
  zoomed: boolean;
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
        className="relative h-2 flex-1 cursor-grab touch-none rounded-full bg-ink/8 active:cursor-grabbing"
      >
        <span
          aria-hidden
          style={{ left: `${String(at(year))}%` }}
          className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-accent"
        />
        <span
          aria-hidden
          style={{ left: `${String(at(view.from))}%`, width: `${String((span / SPAN) * 100)}%` }}
          // The whole range in view: the window is the bar itself, barely there.
          className={`absolute inset-y-0 min-w-2 rounded-full ring-1 ring-paper transition-colors ${zoomed ? "bg-ink/35" : "bg-ink/10"}`}
        />
      </div>
      <button
        onClick={onReset}
        // Kept in place when not needed, so the bar's length never changes.
        disabled={!zoomed}
        aria-hidden={!zoomed}
        tabIndex={zoomed ? 0 : -1}
        className={`rounded-full px-2 text-[11.5px] text-ink-soft hover:bg-paper-2 hover:text-ink ${zoomed ? "" : "invisible"}`}
      >
        {resetLabel}
      </button>
    </div>
  );
}

/**
 * A century back or forward, beside the play button: a round arrow in the play's own
 * shape, quieter; its name (hover and screen readers) says how far. On the narrowest
 * phones the year needs the room, and the slider and the typed year remain.
 */
function YearStep({
  label,
  dir,
  onClick,
}: {
  label: string;
  dir: "back" | "forward";
  onClick: () => void;
}) {
  const Arrow = dir === "back" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-full border border-line text-ink-soft transition hover:border-accent/50 hover:bg-paper-2 hover:text-accent active:scale-95 max-md:size-7 max-[380px]:hidden"
    >
      <Arrow
        className={`size-4 ${dir === "back" ? "-translate-x-px" : "translate-x-px"}`}
        aria-hidden
      />
    </button>
  );
}
