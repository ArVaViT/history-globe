import { YEAR_MAX, type AncientSite, type PolityName, type Renderer } from "@hg/core";
import { useEffect, useState } from "react";
import { formatYear, formatYearRange, type Locale, placeName, pick } from "@hg/model";
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
  const primary = placeName(place, locale);
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
        <div key={p.name} className="text-[12.5px] leading-snug">
          {locale === "ru" ? (p.nameRu ?? p.name) : p.name}
          {p.vassal && (
            <span className="ml-1 tracking-normal normal-case opacity-80">
              {locale === "ru" ? (p.vassalRu ?? p.vassal) : p.vassal}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Over a site of the ancient world layer: its name, what it was and the years it stood.
 * Listens to the renderer itself, as PolityTip does.
 */
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

export function AncientTip({ renderer, locale }: { renderer: Renderer; locale: Locale }) {
  const { t } = useTranslation();
  const [tip, setTip] = useState<{
    site: AncientSite;
    at: { readonly x: number; readonly y: number };
  } | null>(null);
  useEffect(
    () =>
      renderer.on("hoverAncient", (site, at) => {
        setTip(site && at ? { site, at } : null);
      }),
    [renderer],
  );
  if (!tip) return null;
  const { site } = tip;
  const kindKey = `ancient.${site.kind}`;
  // "Capital" alone: the state drawn under it in a later year need not be the one it
  // was the capital of (Bactra under the Ghaznavids).
  const kind = t(kindKey) === kindKey ? "" : t(kindKey);
  const circa = site.approx ? `${t("place.circa")} ` : "";
  // A site still standing at the map's end is "from …", not "… – 1300".
  const years =
    site.to >= YEAR_MAX
      ? t("ancient.since", { year: circa + formatYear(site.from, locale) })
      : circa + formatYearRange(site.from, site.to, locale);
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-64 -translate-y-full rounded-lg bg-ink/90 px-2.5 py-1.5 text-paper shadow-lg"
      // Past the middle of the screen the tip opens to the left, so it never runs off it.
      style={
        tip.at.x > innerWidth / 2
          ? { right: innerWidth - tip.at.x + 14, top: tip.at.y - 10 }
          : { left: tip.at.x + 14, top: tip.at.y - 10 }
      }
    >
      <div className="font-serif text-[14px] leading-tight">
        {pick({ en: site.en, ru: site.ru }, locale) ?? site.en}
        {kind && <span className="ml-1.5 font-sans text-[11px] text-paper/60">{kind}</span>}
      </div>
      <div className="text-[11px] text-paper/70">{years}</div>
    </div>
  );
}
