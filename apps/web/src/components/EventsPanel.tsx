// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { formatRef, formatYear, type HistoryEvent, type Locale, pick } from "@hg/model";
import { useEffect, useEffectEvent, useRef } from "react";
import { useTranslation } from "../i18n";
import { Section } from "./Panel";

/**
 * The turning points of the history (content/events.yaml), in order. On the slider they
 * are gold marks named only on hover; here each one sets the year and, when it belongs
 * to one place, opens that place.
 */
export function EventsPanel({
  events,
  year,
  locale,
  onPick,
}: {
  /** Events, and battles marked `battle` (drawn with crossed swords). */
  events: readonly (HistoryEvent & { readonly battle?: boolean })[];
  year: number;
  locale: Locale;
  onPick: (event: HistoryEvent) => void;
}) {
  const { t } = useTranslation();
  // Opened, the list starts at the map's year: the last event before it at the top.
  const list = useRef<HTMLOListElement>(null);
  const scrollToYear = useEffectEvent(() => {
    const ol = list.current;
    if (!ol) return;
    const next = events.findIndex((e) => e.year >= year);
    // After the last event the list opens at its end, not back at 3500 BC.
    const i = next === -1 ? events.length - 1 : Math.max(0, next - 1);
    const li = ol.children[i];
    if (li instanceof HTMLElement) ol.scrollTop = li.offsetTop - ol.offsetTop;
  });
  // Only on opening: following every year of playback would pull the list from the reader.
  useEffect(() => {
    scrollToYear();
  }, []);
  if (events.length === 0) return null;
  return (
    <Section>
      <ol
        ref={list}
        className="hg-fade max-h-[min(460px,52vh)] max-md:max-h-[calc(100dvh-var(--hg-timeline-h)-200px)] sideways:max-h-[calc(100dvh-var(--hg-timeline-h)-160px)] overflow-y-auto overscroll-contain [scrollbar-width:thin]"
      >
        {events.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => {
                onPick(e);
              }}
              aria-current={e.year === year ? "true" : undefined}
              className={`mx-2 flex w-[calc(100%-16px)] items-baseline gap-3 rounded-xl px-2 py-1 text-left hover:bg-paper-2 ${e.year === year ? "bg-paper-2" : ""}`}
            >
              <span
                className={`${locale === "en" ? "w-[72px]" : "w-[104px]"} shrink-0 text-right text-[11px] whitespace-nowrap text-ink-soft tabular-nums`}
              >
                {e.approximate ? `${t("place.circa")} ` : ""}
                {formatYear(e.year, locale)}
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
                {e.battle && (
                  <span role="img" aria-label={t("legend.battle")} className="mr-1 text-danger">
                    ⚔
                  </span>
                )}
                {pick(e.title, locale)}
                {/* Told in the Bible: where (the place's card links it). */}
                {e.ref && (
                  <span className="text-[12px] text-ink-soft">
                    {" · "}
                    {formatRef(e.ref, locale)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}
