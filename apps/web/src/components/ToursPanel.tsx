import { formatRef, formatYear, isLocale, NT_BOOKS, type Locale } from "@hg/model";
import { useTranslation } from "../i18n";
import { Section } from "./Panel";
import { readUrl } from "../url";
import { lessonSearch } from "../lesson";
import { readPicked, readTitle } from "./LessonRow";
import { useState } from "react";

export function ToursPanel({
  tours,
  onStart,
}: {
  tours: readonly {
    id: string;
    year: number;
    approximate?: boolean | undefined;
    title: Readonly<Record<string, string>>;
    stops: readonly { readonly ref: string }[];
  }[];
  onStart: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale: Locale = isLocale(i18n.language) ? i18n.language : "en";
  const [lesson] = useState(readPicked);
  return (
    <Section>
      {/* Forty-six tours would fill the column: the list scrolls on its own, on a phone too
          (the panel then fits above the timeline and fades out instead of being cut), each
          testament's heading stays in view over its own tours, and a focused tour is kept
          clear of it. */}
      <div className="hg-fade max-h-[min(460px,52vh)] max-md:max-h-[calc(100dvh-var(--hg-timeline-h,124px)-200px)] scroll-pt-7 overflow-y-auto [scrollbar-width:thin]">
        {(["whole", "ot", "nt"] as const).map((testament) => {
          // Tours come sorted by year: the Old Testament ones are before the era. One that
          // runs through both (the empires, Genesis to Acts) stands above them.
          // By the books the stops are read in, not the year: the childhood of Jesus is
          // before AD 1 and in the New Testament.
          const group = tours.filter((tour) => testamentOf(tour.stops) === testament);
          if (group.length === 0) return null;
          return (
            <section key={testament} aria-label={t(`tours.${testament}`)}>
              <div className="sticky top-0 z-[1] bg-paper px-4 pt-2 pb-0.5 text-[11.5px] font-medium text-ink-soft">
                {t(`tours.${testament}`)}
              </div>
              {group.map((tour) => (
                <button
                  key={tour.id}
                  title={t("tours.stops", { count: tour.stops.length })}
                  onClick={() => {
                    onStart(tour.id);
                  }}
                  className="mx-2 flex w-[calc(100%-16px)] rounded-xl px-2 py-1.5 text-left hover:bg-paper-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[14.5px] leading-snug text-ink">
                      {tour.title[i18n.language] ?? tour.title.en}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-soft">
                      {tour.approximate ? `${t("place.circa")} ` : ""}
                      {formatYear(tour.year, locale)} · {tourSpan(tour.stops, locale)}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
      {/* The way to a route of one's own: the lesson button on a place's card (lesson.ts). */}
      {/* Not in a frame on another site, where the cards have no lesson button. */}
      {!readUrl().embed &&
        (lesson.length >= 2 ? (
          // A lesson being built, here too: where the tours are, it starts like one.
          <p className="mx-4 mt-2 flex flex-wrap items-baseline gap-x-3 border-t border-line pt-2 text-[13px]">
            <span className="font-medium text-ink">
              {t("lesson.count", { count: lesson.length })}
            </span>
            <a
              href={lessonSearch(lesson, locale, readTitle())}
              className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {t("lesson.start")}
            </a>
          </p>
        ) : (
          <p className="mx-4 mt-2 border-t border-line pt-2 text-[12px] leading-snug text-ink-soft">
            {t("lesson.hint")}
          </p>
        ))}
    </Section>
  );
}

/**
 * "Деян 13:1–14:28": from the first stop's first verse to the last stop's last verse.
 * When a tour opens with a later verse of the same book (Saul: born in Tarsus, Acts
 * 22:3, then Acts 7-11), it starts from that book's earliest verse instead.
 */
export function tourSpan(stops: readonly { readonly ref: string }[], locale: Locale): string {
  let first = stops[0]?.ref.split("-")[0];
  const last = stops.at(-1)?.ref.split("-").at(-1);
  if (!first || !last) return "";
  const book = (osis: string) => osis.split(".")[0];
  const at = (osis: string) => {
    const [, c = "0", v = "0"] = osis.split(".");
    return Number(c) * 1000 + Number(v);
  };
  try {
    // Across books ("Мф 2:1 – Лк 24:53") the two ends are written in full.
    if (book(first) !== book(last))
      return `${formatRef(first, locale)} – ${formatRef(last, locale)}`;
    if (at(last) < at(first)) {
      const ends = stops
        .flatMap((s) => s.ref.split("-"))
        .filter((r) => book(r) === book(first ?? ""));
      first = ends.reduce((a, b) => (at(b) < at(a) ? b : a));
    }
    return formatRef(first === last ? first : `${first}-${last}`, locale);
  } catch {
    return "";
  }
}

/** Whether a tour's stops read from both testaments. */
function testamentOf(stops: readonly { readonly ref: string }[]): "whole" | "ot" | "nt" {
  const nt = stops.map((s) => NT_BOOKS.has(s.ref.split(".")[0] ?? ""));
  return nt.includes(true) && nt.includes(false) ? "whole" : nt.includes(true) ? "nt" : "ot";
}
