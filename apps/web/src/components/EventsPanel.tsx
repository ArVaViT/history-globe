import { formatYear, type HistoryEvent, type Locale } from "@hg/model";
import { useTranslation } from "react-i18next";
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
  events: readonly HistoryEvent[];
  year: number;
  locale: Locale;
  onPick: (event: HistoryEvent) => void;
}) {
  const { t } = useTranslation();
  if (events.length === 0) return null;
  return (
    <Section
      id="events"
      title={t("events.title")}
      defaultOpen={false}
      className="w-[340px] max-md:w-full pb-3"
    >
      <ol className="max-h-[260px] overflow-y-auto">
        {events.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => {
                onPick(e);
              }}
              aria-current={e.year === year ? "true" : undefined}
              className={`mx-2 flex w-[calc(100%-16px)] items-baseline gap-3 rounded-xl px-2 py-1 text-left hover:bg-paper-2 ${e.year === year ? "bg-paper-2" : ""}`}
            >
              <span className="w-[104px] shrink-0 text-right text-[11px] whitespace-nowrap text-ink-soft tabular-nums">
                {e.approximate ? `${t("place.circa")} ` : ""}
                {formatYear(e.year, locale)}
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
                {e.title[locale] ?? e.title.en}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}
