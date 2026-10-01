import type { Tour } from "@hg/core";
import { formatRef, type Locale } from "@hg/model";
import { ArrowLeft, ArrowRight, X } from "./icons";
import { useTranslation } from "../i18n";
import type { PlaceProps } from "../data";
import { Panel } from "./Panel";
import { verseUrl } from "../links";

export function TourStopCard({
  tour,
  step,
  place,
  locale,
  onStep,
  onClose,
  onOpenPlace,
  stopName,
}: {
  tour: Tour & { title: Readonly<Record<string, string>> };
  step: number;
  place: PlaceProps | undefined;
  locale: Locale;
  onStep: (step: number) => void;
  onClose: () => void;
  /** Leave the tour and open the full card of this stop's place. */
  onOpenPlace: (placeId: string) => void;
  /** The name of the place of any stop, for the step dots. */
  stopName: (placeId: string) => string;
}) {
  const { t } = useTranslation();
  const stop = tour.stops[step];
  if (!stop) return null;
  const name = place
    ? locale === "ru"
      ? (place.name_ru ?? place.name)
      : place.name
    : stop.placeId;
  const last = tour.stops.length - 1;

  return (
    <Panel className="w-[380px] max-md:w-full px-5 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-ink-soft">
          {tour.title[locale] ?? tour.title.en} ·{" "}
          {/* Screen readers hear it in the live region below. */}
          <span aria-hidden>{t("tours.stop", { n: step + 1, total: tour.stops.length })}</span>
        </div>
        <button
          onClick={onClose}
          aria-label={t("tours.close")}
          className="-mr-1 rounded-full p-1.5 text-ink-soft hover:bg-paper-2"
        >
          <X className="size-4" />
        </button>
      </div>
      {/* Read out when the stop changes, by the buttons, the dots or the arrow keys. */}
      <div aria-live="polite" aria-atomic="true">
        <span className="sr-only">
          {t("tours.stop", { n: step + 1, total: tour.stops.length })}.{" "}
        </span>
        <h2 className="mt-1 font-serif text-[26px] leading-tight font-semibold text-ink">{name}</h2>
        <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink">
          {stop.note[locale] ?? stop.note.en}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <a
          href={verseUrl(stop.ref, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white/70 px-2.5 py-0.5 font-serif text-[13px] text-ink hover:border-accent hover:text-accent"
        >
          {formatRef(stop.ref, locale)}
          <span className="sr-only"> ({t("new_tab")})</span>
        </a>
        <button
          onClick={() => {
            onOpenPlace(stop.placeId);
          }}
          className="ml-auto text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {t("tours.about_place")}
        </button>
      </div>
      {/* One dot per stop: where we are, and a jump to any stop. */}
      <ol className="mt-4 flex flex-wrap items-center gap-1" aria-label={t("tours.stops_list")}>
        {tour.stops.map((s, i) => (
          <li key={`${s.placeId}-${String(i)}`}>
            <button
              onClick={() => {
                onStep(i);
              }}
              aria-current={i === step ? "step" : undefined}
              aria-label={`${String(i + 1)}. ${stopName(s.placeId)}`}
              title={`${String(i + 1)}. ${stopName(s.placeId)}`}
              className={`block rounded-full transition-all ${i === step ? "h-2.5 w-6 bg-accent" : i < step ? "size-2.5 bg-accent/55 hover:bg-accent" : "size-2.5 bg-paper-2 ring-1 ring-line hover:bg-accent/40"}`}
            />
          </li>
        ))}
      </ol>
      <div className="mt-3 flex justify-between">
        <button
          disabled={step === 0}
          onClick={() => {
            onStep(step - 1);
          }}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ink-soft enabled:hover:bg-paper-2 disabled:opacity-40"
        >
          <ArrowLeft className="size-4" /> {t("tours.prev")}
        </button>
        <button
          onClick={() => {
            if (step < last) onStep(step + 1);
            else onClose();
          }}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm text-paper hover:brightness-110"
        >
          {step < last ? t("tours.next") : t("tours.close")}{" "}
          {step < last && <ArrowRight className="size-4" />}
        </button>
      </div>
    </Panel>
  );
}
