import { formatRange, type Locale } from "@hg/model";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { cachedJson } from "../../data";
import { POLITY_COLORS } from "@hg/core";

type RulerData = {
  readonly states: readonly {
    readonly n: string;
    readonly c: number;
    readonly names: Readonly<Record<string, string>>;
  }[];
  readonly places: Readonly<Record<string, readonly (readonly [number, number, number])[]>>;
};
/** Who ruled each place, century by century (scripts/build-polities.ts); null if it failed. */
const loadRulers = () => cachedJson<RulerData>("rulers.json").catch(() => null);

/**
 * Who ruled here, as one thin band of the map's state colours from the first state to the
 * last: a segment named on hover or focus, and a click on it takes the map to that year.
 */
export function Rulers({
  placeId,
  year,
  locale,
  onYear,
}: {
  placeId: string;
  year: number;
  locale: Locale;
  onYear?: ((year: number) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<RulerData | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const band = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    void loadRulers().then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);
  const runs = data?.places[placeId];
  if (!data || !runs || runs.length < 2) return null;
  const from = runs[0]?.[0] ?? 0;
  const to = runs.at(-1)?.[1] ?? 0;
  const nameOfRun = (k: number) => {
    const [a, b, i] = runs[k] ?? [0, 0, 0];
    const st = data.states[i];
    return `${st?.names[locale] ?? st?.n ?? ""}, ${formatRange({ from: a, to: b }, locale)}`;
  };
  const now = runs.findIndex(([a, b]) => a <= year && year < b);
  // The state of the year shown is named on the line above; this one names what the
  // reader points at, and otherwise the span.
  const line = shown;
  const focusAt = shown ?? (now >= 0 ? now : 0);
  // Gaps (no state on the map there) stay empty, so the band keeps its time scale.
  const cells: { k: number | null; span: number }[] = [];
  runs.forEach(([a, b], k) => {
    const prev = k > 0 ? (runs[k - 1]?.[1] ?? a) : a;
    if (a > prev) cells.push({ k: null, span: a - prev });
    cells.push({ k, span: b - a });
  });
  return (
    <div className="px-5 pt-2">
      {/* One stop for the Tab key, the arrows from state to state (a toolbar's roving focus):
          a band of thirty states is not thirty stops. */}
      <div
        ref={band}
        role="toolbar"
        aria-label={t("place.rulers", { span: formatRange({ from, to }, locale) })}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink/5"
        onMouseLeave={() => {
          setShown(null);
        }}
        onKeyDown={(e) => {
          const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          const jump = { Home: 0, End: runs.length - 1 }[e.key];
          if (step === undefined && jump === undefined) return;
          e.preventDefault();
          const next = jump ?? Math.min(runs.length - 1, Math.max(0, focusAt + (step ?? 0)));
          band.current?.querySelector<HTMLButtonElement>(`[data-run="${String(next)}"]`)?.focus();
        }}
      >
        {cells.map(({ k, span }, n) =>
          k === null ? (
            <span key={n} style={{ flexGrow: span }} />
          ) : (
            <button
              key={n}
              type="button"
              data-run={k}
              tabIndex={k === focusAt ? 0 : -1}
              aria-label={nameOfRun(k)}
              title={nameOfRun(k)}
              style={{
                flexGrow: span,
                background:
                  POLITY_COLORS[(data.states[runs[k]?.[2] ?? 0]?.c ?? 0) % POLITY_COLORS.length],
              }}
              className={`min-w-px border-r border-paper/60 last:border-r-0 focus-visible:outline-2 ${
                k === now ? "opacity-100" : "opacity-55 hover:opacity-100"
              }`}
              onMouseEnter={() => {
                setShown(k);
              }}
              onFocus={() => {
                setShown(k);
              }}
              onBlur={() => {
                setShown(null);
              }}
              onClick={() => {
                onYear?.(runs[k]?.[0] ?? year);
              }}
            />
          ),
        )}
      </div>
      <div className="mt-1 text-[11.5px] leading-snug text-ink-soft">
        {line !== null
          ? nameOfRun(line)
          : t("place.rulers", { span: formatRange({ from, to }, locale) })}
      </div>
    </div>
  );
}

/** What ancient authors say of places (content/ancient-authors.yaml); none if it failed. */
