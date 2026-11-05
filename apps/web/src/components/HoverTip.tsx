import { polityText, type PolityName, type Renderer } from "@hg/core";
import { useEffect, useState } from "react";
import { formatYear, type Locale, placeName, pick } from "@hg/model";
import { useTranslation } from "../i18n";
import { hasOwnName, standingSpan, whereIn, type PlaceProps } from "../data";

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
  // A place of the ancient world says what it was ("capital"; a city, nothing): the state
  // drawn under it in a later year need not be the one it was the capital of.
  const kindKey = place.ancient ? `ancient.${place.ancient}` : `kind.${place.kind}`;
  const kind = t(kindKey) === kindKey ? "" : t(kindKey);
  const primary = placeName(place, locale);
  // Under a name of the reader's language, the English one; else where it is today, or
  // when a place of the ancient world stood.
  const secondary = hasOwnName(place, locale)
    ? place.name
    : place.ancient
      ? standingSpan(place, t, locale)
      : place.where !== place.name
        ? (whereIn(place, locale) ?? place.where)
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
      {tip.polities.slice(0, 3).map((p) => {
        const { name, vassal } = polityText(p, locale);
        return (
          <div key={p.name} className="text-[12.5px] leading-snug">
            {name}
            {vassal && (
              <span className="ml-1 tracking-normal normal-case opacity-80">{vassal}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A battle's name and year by its mark (the place's tip would name the place under it). */
export function BattleTip({ renderer, locale }: { renderer: Renderer; locale: Locale }) {
  const { t } = useTranslation();
  const [tip, setTip] = useState<{
    battle: {
      readonly en: string;
      readonly ru: string;
      readonly year: number;
      readonly approx: boolean;
    };
    at: { readonly x: number; readonly y: number };
  } | null>(null);
  useEffect(
    () =>
      renderer.on("hoverBattle", (battle, at) => {
        setTip(battle && at ? { battle, at } : null);
      }),
    [renderer],
  );
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-64 -translate-y-full rounded-lg bg-ink/90 px-2.5 py-1.5 text-paper shadow-lg"
      style={
        tip.at.x > innerWidth / 2
          ? { right: innerWidth - tip.at.x + 14, top: tip.at.y - 10 }
          : { left: tip.at.x + 14, top: tip.at.y - 10 }
      }
    >
      <div className="font-serif text-[14px] leading-tight">{pick(tip.battle, locale) ?? ""}</div>
      <div className="text-[11px] text-paper/70">
        {tip.battle.approx ? `${t("place.circa")} ` : ""}
        {formatYear(tip.battle.year, locale)}
      </div>
    </div>
  );
}
