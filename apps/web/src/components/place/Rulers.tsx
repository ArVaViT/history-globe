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
  /** The last press was a finger or a pen: the click picks the nearest age. */
  const touch = useRef(false);
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
  // A finger is wider than most ages on the band (one century of thirty is a pixel or two):
  // a tap picks the age nearest to it, an empty stretch included, and names it below.
  const nearest = (x: number): number | null => {
    let best: { k: number; d: number } | null = null;
    for (const el of band.current?.querySelectorAll<HTMLElement>("[data-run]") ?? []) {
      const r = el.getBoundingClientRect();
      const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (!best || d < best.d) best = { k: Number(el.dataset.run), d };
    }
    return best?.k ?? null;
  };
  const choose = (k: number) => {
    setShown(k);
    onYear?.(runs[k]?.[0] ?? year);
  };
  return (
    <div className="px-5 pt-2">
      {/* One stop for the Tab key, the arrows from state to state (a toolbar's roving focus):
          a band of thirty states is not thirty stops. The band is drawn 10 px high in a row
          24 px high, the height a finger or a pointer may hit (WCAG 2.5.8). */}
      <div
        ref={band}
        role="toolbar"
        aria-label={t("place.rulers", { span: formatRange({ from, to }, locale) })}
        className="relative flex h-6 w-full items-center before:absolute before:inset-x-0 before:top-1/2 before:h-2.5 before:-translate-y-1/2 before:rounded-full before:bg-ink/5"
        onMouseLeave={() => {
          setShown(null);
        }}
        onPointerDown={(e) => {
          touch.current = e.pointerType !== "mouse";
        }}
        onClick={(e) => {
          // A tap: the nearest age, wherever on the band it landed (a press with a mouse or
          // a key is the button's own; e.detail is 0 for a key).
          if (!touch.current || e.detail === 0) return;
          const k = nearest(e.clientX);
          if (k !== null) choose(k);
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
              style={{ flexGrow: span }}
              className={`hg-tap-own group relative h-full min-w-px focus-visible:outline-2 ${
                k === now ? "" : "opacity-55 hover:opacity-100"
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
              onClick={(e) => {
                if (!touch.current || e.detail === 0) choose(k);
              }}
            >
              <span
                aria-hidden
                style={{
                  background:
                    POLITY_COLORS[(data.states[runs[k]?.[2] ?? 0]?.c ?? 0) % POLITY_COLORS.length],
                }}
                className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 border-r border-paper/60 group-first:rounded-l-full group-last:rounded-r-full group-last:border-r-0"
              />
            </button>
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
