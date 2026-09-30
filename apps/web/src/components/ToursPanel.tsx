import { formatRef, formatYear, type Locale } from "@hg/model";
import { Route } from "./icons";
import { useTranslation } from "../i18n";
import { Section } from "./Panel";

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
  const locale: Locale = i18n.language === "ru" ? "ru" : "en";
  return (
    <Section id="tours" title={t("tours.title")} className="w-[340px] max-md:w-full pb-3">
      {tours.map((tour, i) => (
        <div key={tour.id}>
          {/* Old Testament tours before the New; tours come sorted by year. */}
          {i === 0 || (tours[i - 1]?.year ?? 0) < 0 !== tour.year < 0 ? (
            <div className="px-4 pt-2 pb-0.5 text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">
              {tour.year < 0 ? t("tours.ot") : t("tours.nt")}
            </div>
          ) : null}
          <button
            title={t("tours.stops", { count: tour.stops.length })}
            onClick={() => {
              onStart(tour.id);
            }}
            className="group mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-paper-2"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/90 text-paper group-hover:bg-accent">
              <Route className="size-3.5" aria-hidden />
            </span>
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
        </div>
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
