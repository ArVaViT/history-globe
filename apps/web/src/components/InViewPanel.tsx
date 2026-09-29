import type { Locale } from "@hg/model";
import { useTranslation } from "react-i18next";
import { beforeItsTime, type LoadedData } from "../data";
import { Panel, PanelTitle } from "./Panel";

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
  const places = ids
    .map((id) => data.byId.get(id)?.props)
    .filter((p) => p !== undefined)
    .filter((p) => !p.dup && !(locale === "ru" && p.dup_ru))
    // Faded places (named only in the New Testament, before its events) go last.
    .sort(
      (a, b) =>
        Number(beforeItsTime(a, year)) - Number(beforeItsTime(b, year)) || b.verses - a.verses,
    )
    .slice(0, SHOWN);
  if (places.length === 0) return null;

  return (
    <Panel className="w-[340px] pb-2">
      <PanelTitle>{t("inview.title")}</PanelTitle>
      <ul aria-label={t("inview.title")}>
        {places.map((p) => (
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
    </Panel>
  );
}
