import type { PolityName } from "@hg/core";
import type { Locale } from "@hg/model";
import type { PlaceProps } from "../data";

/** Small label that follows the pointer over a place: name, and the other-language name. */
export function HoverTip({
  place,
  at,
  locale,
}: {
  place: PlaceProps;
  at: { x: number; y: number };
  locale: Locale;
}) {
  const ru = locale === "ru";
  const primary = ru ? (place.name_ru ?? place.name) : place.name;
  const secondary =
    ru && place.name_ru ? place.name : place.where !== place.name ? place.where : "";
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-y-full rounded-lg bg-ink/90 px-2.5 py-1.5 text-paper shadow-lg"
      style={{ left: at.x + 14, top: at.y - 10 }}
    >
      <div className="font-serif text-[14px] leading-tight">{primary}</div>
      {secondary && <div className="text-[11px] text-paper/70">{secondary}</div>}
    </div>
  );
}

/** Over a territory, not a place: the states drawn there, topmost first. */
export function PolityTip({
  polities,
  at,
  locale,
}: {
  polities: readonly PolityName[];
  at: { x: number; y: number };
  locale: Locale;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-y-full rounded-lg bg-ink/75 px-2.5 py-1 text-paper shadow"
      style={{ left: at.x + 14, top: at.y - 10 }}
    >
      {polities.slice(0, 3).map((p) => (
        <div key={p.name} className="text-[12px] leading-snug tracking-wide uppercase">
          {locale === "ru" ? (p.nameRu ?? p.name) : p.name}
        </div>
      ))}
    </div>
  );
}
