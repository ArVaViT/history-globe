import type { Tour } from "@hg/core";
import { formatRef, type Locale } from "@hg/model";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
}: {
  tour: Tour & { title: Readonly<Record<string, string>> };
  step: number;
  place: PlaceProps | undefined;
  locale: Locale;
  onStep: (step: number) => void;
  onClose: () => void;
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
    <Panel className="w-[380px] px-5 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-ink-soft">
          {tour.title[locale] ?? tour.title.en} ·{" "}
          {t("tours.stop", { n: step + 1, total: tour.stops.length })}
        </div>
        <button
          onClick={onClose}
          aria-label={t("tours.close")}
          className="-mr-1 rounded-full p-1.5 text-ink-soft hover:bg-paper-2"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 className="mt-1 font-serif text-[26px] leading-tight font-semibold text-ink">{name}</h2>
      <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink">
        {stop.note[locale] ?? stop.note.en}
      </p>
      <div className="mt-3">
        <a
          href={verseUrl(stop.ref, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white/70 px-2.5 py-0.5 font-serif text-[13px] text-ink hover:border-accent hover:text-accent"
        >
          {formatRef(stop.ref, locale)}
          <span className="sr-only"> ({t("new_tab")})</span>
        </a>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-paper-2">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${((step + 1) / tour.stops.length) * 100}%` }}
        />
      </div>
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
