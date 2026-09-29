import { formatRef, type Locale } from "@hg/model";
import { MapPin, X, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { beforeItsTime, type PlaceProps, type Site } from "../data";
import { Panel } from "./Panel";

const VERSES_SHOWN = 10;

function safeRef(osis: string, locale: Locale): string {
  try {
    return formatRef(osis, locale);
  } catch {
    return osis;
  }
}

export function PlaceCard({
  place,
  sites,
  locale,
  year,
  onClose,
  onZoom,
  onFlyTo,
}: {
  place: PlaceProps;
  sites: readonly Site[];
  locale: Locale;
  year: number;
  onClose: () => void;
  onZoom: () => void;
  onFlyTo: (at: readonly [number, number]) => void;
}) {
  const { t } = useTranslation();
  const ru = locale === "ru";
  const title = ru ? (place.name_ru ?? place.name) : place.name;
  const kindKey = `kind.${place.kind}`;
  const kind = t(kindKey) === kindKey ? place.kind : t(kindKey);

  return (
    <Panel className="w-[380px] max-h-[calc(100vh-200px)] overflow-auto">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="font-serif text-[26px] leading-tight font-semibold text-ink">{title}</h2>
          {ru && place.name_ru && (
            <div className="font-serif text-[15px] text-ink-soft italic">{place.name}</div>
          )}
          {ru && place.name_ru_osis && (
            <div className="mt-0.5 text-[11px] text-ink-soft">
              {t("place.synodal_from", { ref: safeRef(place.name_ru_osis, locale) })}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t("place.close")}
          className="-mr-1 rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-5 pt-3">
        <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-xs text-ink-soft">
          {kind}
        </span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${place.sites > 1 ? "border-[#e0b98f] bg-[#f4dfc9] text-[#7a4a1d]" : "border-line bg-paper-2 text-ink-soft"}`}
        >
          {place.sites > 1 ? t("place.sites", { count: place.sites }) : t("place.single_site")}
        </span>
      </div>

      <div className="px-5 pt-3">
        <button
          onClick={onZoom}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm text-paper hover:brightness-110"
        >
          <ZoomIn className="size-4" aria-hidden /> {t("place.zoom")}
        </button>
      </div>

      {sites.length > 1 && (
        <div className="mx-5 mt-4 rounded-xl border border-[#e0b98f] bg-[#fbf1e4] px-3 py-2.5">
          <div className="text-[11px] font-medium tracking-[0.12em] text-[#7a4a1d] uppercase">
            {t("place.sites_title")}
          </div>
          <ul className="mt-1.5 space-y-1">
            {sites.map((s) => (
              <li key={`${s.label}-${s.at.join(",")}`}>
                <button
                  onClick={() => {
                    onFlyTo(s.at);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-paper-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{s.label}</span>
                  {s.share !== null && (
                    <>
                      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-paper-2">
                        <span className="block h-full bg-accent" style={{ width: `${s.share}%` }} />
                      </span>
                      <span className="w-9 shrink-0 text-right text-[12px] text-ink-soft tabular-nums">
                        {s.share}%
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 text-[10.5px] leading-snug text-ink-soft">
            {t("place.sites_note")}
          </div>
        </div>
      )}

      {beforeItsTime(place, year) && (
        <div className="mx-5 mt-3 text-[12.5px] leading-snug text-ink-soft italic">
          {t("place.nt_only")}
        </div>
      )}

      {place.where && place.where !== place.name && (
        <div className="flex items-center gap-1.5 px-5 pt-3 text-[14px] text-ink">
          <MapPin className="size-4 text-accent" aria-hidden />
          <span className="text-ink-soft">{t("place.today")}:</span> {place.where}
        </div>
      )}

      <div className="mx-5 mt-4 grid grid-cols-3 gap-2 rounded-xl border border-line bg-paper-2/70 p-3 text-center">
        <Stat value={place.verses} label={t("place.mentions")} />
        <Stat value={place.ot} label={t("place.ot")} />
        <Stat value={place.nt} label={t("place.nt")} />
      </div>

      <div className="px-5 pt-4 text-[11px] font-medium tracking-[0.12em] text-ink-soft uppercase">
        {t("place.verses")}
      </div>
      <div className="flex flex-wrap gap-1.5 px-5 pt-2">
        {place.osis.slice(0, VERSES_SHOWN).map((o) => (
          <span
            key={o}
            className="rounded-full border border-line bg-white/70 px-2.5 py-0.5 font-serif text-[13px] text-ink"
          >
            {safeRef(o, locale)}
          </span>
        ))}
        {place.verses > VERSES_SHOWN && (
          <span className="rounded-full px-2 py-0.5 text-[13px] text-ink-soft">
            {t("place.more", { count: place.verses - VERSES_SHOWN })}
          </span>
        )}
      </div>

      <p className="mx-5 mt-4 rounded-xl border border-dashed border-line px-3 py-2.5 font-serif text-[14px] leading-relaxed text-ink-soft italic">
        {t("place.article_soon", { name: title })}
      </p>

      <div className="px-5 pt-3 pb-4 text-[11px] text-ink-soft">
        OpenBible.info (CC BY 4.0)
        {place.coord === "wikidata" ? ` · ${t("place.coords_wikidata")}` : ""}
      </div>
    </Panel>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-serif text-[22px] font-semibold text-ink">{value}</div>
      <div className="text-[11px] leading-tight text-ink-soft">{label}</div>
    </div>
  );
}
