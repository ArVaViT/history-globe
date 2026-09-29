import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import { formatYear, PERIODS, periodAt, type Locale } from "@hg/model";
import { ChevronsLeft, ChevronsRight, Pause, Play } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
/** Labelled ticks as astronomical years: 2000, 1500, 1000 and 500 BC, and AD 100. */
const TICKS = [-1999, -1499, -999, -499, 100];

function pct(year: number): number {
  return ((year - YEAR_MIN) / SPAN) * 100;
}

/** "1000 BC – 831 BC": the first and the last year of a half-open range. */
export function formatPeriodRange(range: { from: number; to: number }, locale: Locale): string {
  return `${formatYear(range.from, locale)} – ${formatYear(range.to - 1, locale)}`;
}

export function Timeline({
  year,
  locale,
  playing,
  hints,
  onYear,
  onPlay,
}: {
  year: number;
  locale: Locale;
  playing: boolean;
  hints: string;
  onYear: (year: number) => void;
  onPlay: () => void;
}) {
  const { t } = useTranslation();
  const period = periodAt(year);
  const ru = locale === "ru";
  // The era band under the pointer: the slider covers the bands, so native titles never show.
  const [hover, setHover] = useState<{ x: number; year: number } | null>(null);
  const hovered = hover ? periodAt(hover.year) : undefined;
  const periodName = period ? (ru ? period.name.ru : period.name.en) : "";

  return (
    <Panel className="w-[min(920px,calc(100vw-760px))] min-w-[560px] px-5 pt-3 pb-3">
      <div role="group" aria-label={t("time.timeline")}>
        <div className="flex items-center gap-4">
          <div className="min-w-[210px] font-serif text-[28px] leading-none font-semibold text-ink tabular-nums">
            {formatYear(year, locale)}
          </div>
          <div className="flex-1 text-[13px] leading-snug text-ink-soft">
            {periodName}
            {period?.disputed && (
              <span className="ml-2 rounded-full bg-[#f4dfc9] px-2 py-0.5 text-[11px] text-[#7a4a1d]">
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
          </div>
        </div>

        <div
          className="relative mt-3 h-10"
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const frac = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
            setHover({ x: frac * 100, year: Math.round(YEAR_MIN + frac * SPAN) });
          }}
          onPointerLeave={() => {
            setHover(null);
          }}
        >
          {hovered && hover && (
            <div
              role="tooltip"
              style={{ left: `${hover.x}%` }}
              className={`pointer-events-none absolute bottom-full mb-2 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-tight whitespace-nowrap text-paper shadow-lg ${hover.x < 15 ? "" : hover.x > 85 ? "-translate-x-full" : "-translate-x-1/2"}`}
            >
              <div className="font-medium">{ru ? hovered.name.ru : hovered.name.en}</div>
              <div className="text-paper/75 tabular-nums">
                {formatPeriodRange(hovered.range, locale)}
              </div>
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-x-0 top-1 flex h-3 overflow-hidden rounded-full"
          >
            {PERIODS.map((p, i) => (
              <div
                key={p.id}
                style={{
                  width: `${pct(Math.min(p.range.to, YEAR_MAX + 1)) - pct(p.range.from)}%`,
                  background: BAND_COLORS[i % BAND_COLORS.length],
                }}
                className={p.id === period?.id ? "opacity-100" : "opacity-55"}
              />
            ))}
          </div>
          <input
            type="range"
            min={YEAR_MIN}
            max={YEAR_MAX}
            step={1}
            value={year}
            onChange={(e) => {
              onYear(Number(e.target.value));
            }}
            aria-label={t("time.year")}
            aria-valuetext={
              periodName ? `${formatYear(year, locale)}, ${periodName}` : formatYear(year, locale)
            }
            className="timeline-range absolute inset-x-0 top-0 h-5 w-full"
          />
          {TICKS.map((y, i) => (
            <span
              key={y}
              aria-hidden
              style={{ left: `${pct(y)}%` }}
              className={`absolute top-6 text-[11px] whitespace-nowrap text-ink-soft ${i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            >
              {formatYear(y, locale)}
            </span>
          ))}
          {/* The turn of the era, marked but not labelled: its label would collide with AD 100. */}
          <span
            style={{ left: `${pct(1)}%` }}
            aria-hidden
            className="absolute top-0 h-5 w-px -translate-x-1/2 bg-ink/50"
          />
        </div>
        <div className="mt-1 text-right text-[10.5px] text-ink-soft/80">{hints}</div>
      </div>
    </Panel>
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
