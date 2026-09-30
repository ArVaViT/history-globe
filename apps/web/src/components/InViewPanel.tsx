import type { Locale } from "@hg/model";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { beforeItsTime, type LoadedData } from "../data";
import { Section } from "./Panel";

const SHOWN = 10;

/**
 * The places currently on screen, most mentioned first. It is the keyboard and
 * screen-reader path into the map (ADR 0006): every entry is a real button.
 */
export function InViewPanel({
  ids,
  data,
  locale,
  year,
  selected,
  onSelect,
}: {
  ids: readonly string[];
  data: LoadedData;
  locale: Locale;
  year: number;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  // Ten at first; "ещё N" opens ten more.
  const [shown, setShown] = useState(SHOWN);
  const places = ids
    .map((id) => data.byId.get(id)?.props)
    .filter((p) => p !== undefined)
    .filter((p) => !p.dup && !(locale === "ru" && p.dup_ru))
    // Faded places (named only in the New Testament, before its events) go last.
    .sort(
      (a, b) =>
        Number(beforeItsTime(a, year)) - Number(beforeItsTime(b, year)) || b.verses - a.verses,
    );
  const visible = places.slice(0, shown);
  if (places.length === 0) return null;

  return (
    <Section id="inview" title={t("inview.title")} className="w-[340px] max-md:w-full pb-2">
      <ul aria-label={t("inview.title")}>
        {visible.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => {
                onSelect(p.id);
              }}
              aria-current={p.id === selected}
              className={`flex w-full items-baseline justify-between gap-3 px-4 py-1 text-left hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:outline-none ${p.id === selected ? "text-accent" : "text-ink"} ${beforeItsTime(p, year) ? "opacity-50" : ""}`}
            >
              <span className="truncate font-serif text-[14.5px]">
                {locale === "ru" ? (p.name_ru ?? p.name) : p.name}
              </span>
              <span className="shrink-0 text-[11px] text-ink-soft tabular-nums">
                {t("inview.verses", { count: p.verses })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {places.length > shown && (
        <button
          onClick={() => {
            setShown(shown + SHOWN);
          }}
          className="px-4 pt-1 text-[12.5px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {t("place.more", { count: places.length - shown })}
        </button>
      )}
    </Section>
  );
}
