import { formatRef, type Locale } from "@hg/model";
import { Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, PanelTitle } from "./Panel";

export function ToursPanel({
  tours,
  onStart,
}: {
  tours: readonly {
    id: string;
    title: Readonly<Record<string, string>>;
    stops: readonly { readonly ref: string }[];
  }[];
  onStart: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Panel className="w-[340px] pb-3">
      <PanelTitle>{t("tours.title")}</PanelTitle>
      {tours.map((tour) => (
        <button
          key={tour.id}
          onClick={() => {
            onStart(tour.id);
          }}
          className="mx-3 mt-1 flex w-[calc(100%-24px)] items-center gap-3 rounded-xl border border-line bg-paper-2/60 px-3 py-2.5 text-left hover:bg-paper-2"
        >
          <span className="grid size-9 place-items-center rounded-full bg-accent text-paper">
            <Route className="size-4" />
          </span>
          <span>
            <span className="block font-serif text-[15px] text-ink">
              {tour.title[i18n.language] ?? tour.title.en}
            </span>
            <span className="block text-xs text-ink-soft">
              {tourSpan(tour.stops, i18n.language === "ru" ? "ru" : "en")} · {tour.stops.length}
            </span>
          </span>
        </button>
      ))}
    </Panel>
  );
}

/** "Деян 13:1–14:28": from the first stop's first verse to the last stop's last verse. */
export function tourSpan(stops: readonly { readonly ref: string }[], locale: Locale): string {
  const first = stops[0]?.ref.split("-")[0];
  const last = stops.at(-1)?.ref.split("-").at(-1);
  if (!first || !last) return "";
  try {
    return formatRef(first === last ? first : `${first}-${last}`, locale);
  } catch {
    return "";
  }
}
