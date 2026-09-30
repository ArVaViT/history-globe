import type { PolityName, Renderer } from "@hg/core";
import { useEffect, useState } from "react";
import type { Locale } from "@hg/model";
import { useTranslation } from "../i18n";
import type { PlaceProps } from "../data";

/** Small label that follows the pointer over a place: name, its kind, and the other-language name. */
export function HoverTip({
  place,
  at,
  locale,
}: {
  place: PlaceProps;
  at: { x: number; y: number };
  locale: Locale;
}) {
  const { t } = useTranslation();
  const ru = locale === "ru";
  const kindKey = `kind.${place.kind}`;
  const kind = t(kindKey) === kindKey ? "" : t(kindKey);
  const primary = ru ? (place.name_ru ?? place.name) : place.name;
  const secondary =
    ru && place.name_ru
      ? place.name
      : place.where !== place.name
        ? ru
          ? (place.where_ru ?? place.where)
          : place.where
        : "";
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-y-full rounded-lg bg-ink/90 px-2.5 py-1.5 text-paper shadow-lg"
      style={{ left: at.x + 14, top: at.y - 10 }}
    >
      <div className="font-serif text-[14px] leading-tight">
        {primary}
        {kind && <span className="ml-1.5 font-sans text-[11px] text-paper/60">{kind}</span>}
      </div>
      {secondary && <div className="text-[11px] text-paper/70">{secondary}</div>}
    </div>
  );
}

/**
 * Over a territory, not a place: the states drawn there, topmost first. It listens to the
 * renderer itself, so following the mouse re-renders this tip and not the whole app.
 */
export function PolityTip({ renderer, locale }: { renderer: Renderer; locale: Locale }) {
  const [tip, setTip] = useState<{
    polities: readonly PolityName[];
    at: { readonly x: number; readonly y: number };
  } | null>(null);
  useEffect(
    () =>
      renderer.on("hoverPolity", (polities, at) => {
        setTip(polities && at ? { polities, at } : null);
      }),
    [renderer],
  );
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-y-full rounded-lg bg-ink/75 px-2.5 py-1 text-paper shadow"
      style={{ left: tip.at.x + 14, top: tip.at.y - 10 }}
    >
      {tip.polities.slice(0, 3).map((p) => (
        <div key={p.name} className="text-[12px] leading-snug tracking-wide uppercase">
          {locale === "ru" ? (p.nameRu ?? p.name) : p.name}
        </div>
      ))}
    </div>
  );
}
