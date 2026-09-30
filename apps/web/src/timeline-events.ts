import type { Locale } from "@hg/model";
import type { TimelineEvent } from "./components/Timeline";
import type { LoadedData } from "./data";

/** i18next's `t`, reduced to what is used here. */
type T = (key: string, options: { name: string }) => string;

/**
 * The marks on the time slider: the turning points of the history (events.yaml) and the
 * founding, destruction and rebuilding of places (place-life.yaml). Another name of a place
 * (Zion) and places inside it (its gates) share its years and are not marked again; a
 * place's own event that repeats a turning point (Jerusalem, 586 BC) is not shown twice.
 */
export function timelineEventsOf(
  data: Pick<LoadedData, "life" | "byId" | "events">,
  locale: Locale,
  t: T,
): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const [id, life] of Object.entries(data.life)) {
    const p = data.byId.get(id)?.props;
    if (!p || p.where_tpl === "same" || p.where_tpl === "at") continue;
    const name = locale === "ru" ? (p.name_ru ?? p.name) : p.name;
    const covered = (year: number) =>
      data.events.some((e) => e.place === id && Math.abs(e.year - year) <= 2);
    const add = (y: { year: number; approximate: boolean } | undefined, key: string) => {
      if (y && !covered(y.year))
        out.push({ year: y.year, label: t(key, { name }), approximate: y.approximate });
    };
    add(life.from, "events.founded");
    add(life.until, "events.destroyed");
    add(life.gap?.from, "events.destroyed");
    // The gap's `until` is its last year in ruins: rebuilt the year after.
    const back = life.gap?.until;
    add(back && { ...back, year: back.year + 1 }, "events.rebuilt");
  }
  for (const e of data.events) {
    out.push({
      year: e.year,
      label: e.title[locale] ?? e.title.en ?? "",
      approximate: e.approximate,
      major: true,
    });
  }
  // Turning points first in the tip, then the rest by year.
  return out.sort((a, b) => Number(b.major ?? false) - Number(a.major ?? false) || a.year - b.year);
}
