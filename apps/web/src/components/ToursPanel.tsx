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
    stops: readonly unknown[];
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
              {i18n.language === "ru" ? "Деян 13–14" : "Acts 13–14"} · {tour.stops.length}
            </span>
          </span>
        </button>
      ))}
    </Panel>
  );
}
