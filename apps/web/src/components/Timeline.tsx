import { YEAR_MAX, YEAR_MIN } from "@hg/core";
import { formatYear, PERIODS, periodAt, type Locale } from "@hg/model";
import { ChevronsLeft, ChevronsRight, Pause, Play } from "lucide-react";
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
/** Tick marks as astronomical years: 2000 BC, 1500 BC, 1000 BC, 500 BC, the BC/AD turn, AD 100. */
const TICKS = [-1999, -1499, -999, -499, 1, 100];

function pct(year: number): number {
  return ((year - YEAR_MIN) / SPAN) * 100;
}

export function Timeline({
  year,
  locale,
  playing,
  onYear,
  onPlay,
}: {
  year: number;
  locale: Locale;
  playing: boolean;
  onYear: (year: number) => void;
  onPlay: () => void;
}) {
  const { t } = useTranslation();
  const period = periodAt(year);
  const ru = locale === "ru";

  return (
    <Panel className="w-[min(920px,calc(100vw-760px))] min-w-[560px] px-5 pt-3 pb-3">
      <div className="flex items-center gap-4">
        <div className="min-w-[210px] font-serif text-[28px] leading-none font-semibold text-ink tabular-nums">
          {formatYear(year, locale)}
        </div>
        <div className="flex-1 text-[13px] leading-snug text-ink-soft">
          {period && (ru ? period.name.ru : period.name.en)}
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
            <ChevronsLeft className="size-4" />
          </IconButton>
          <button
            onClick={onPlay}
            aria-label={playing ? t("time.pause") : t("time.play")}
            className="grid size-10 place-items-center rounded-full bg-accent text-paper shadow hover:brightness-110"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
          </button>
          <IconButton
            label={t("time.forward", { n: 100 })}
            onClick={() => {
              onYear(year + 100);
            }}
          >
            <ChevronsRight className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="relative mt-3 h-10">
        <div className="absolute inset-x-0 top-1 flex h-3 overflow-hidden rounded-full">
          {PERIODS.map((p, i) => (
            <div
              key={p.id}
              title={ru ? p.name.ru : p.name.en}
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
          aria-label={formatYear(year, locale)}
          aria-valuetext={formatYear(year, locale)}
          className="timeline-range absolute inset-x-0 top-0 h-5 w-full"
        />
        {TICKS.map((y) => (
          <span
            key={y}
            style={{ left: `${pct(y)}%` }}
            className="absolute top-6 -translate-x-1/2 text-[11px] whitespace-nowrap text-ink-soft first:translate-x-0 last:-translate-x-full"
          >
            {y === 1 ? (ru ? "Р. Х." : "BC | AD") : formatYear(y, locale)}
          </span>
        ))}
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
