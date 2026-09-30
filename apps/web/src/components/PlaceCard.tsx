import { formatRef, formatYear, type Locale, type PlaceLife } from "@hg/model";
import { ExternalLink, MapPin, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { beforeItsTime, type PlaceProps, type Site } from "../data";
import { mapsUrl, verseUrl } from "../links";
import { Panel } from "./Panel";

const VERSES_SHOWN = 10;

/** "ок. 20 г. н. э." for an approximate year. */
function lifeYear(
  y: { year: number; approximate: boolean },
  locale: Locale,
  t: (key: string) => string,
): string {
  return `${y.approximate ? `${t("place.circa")} ` : ""}${formatYear(y.year, locale)}`;
}

function safeRef(osis: string, locale: Locale): string {
  try {
    return formatRef(osis, locale);
  } catch {
    return osis;
  }
}

/** Other records on the same point shown before "and N more". */
const ALSO_SHOWN = 5;

export function PlaceCard({
  place,
  sites,
  life,
  at,
  alsoHere,
  locale,
  year,
  onClose,
  onSelect,
  onZoom,
  onFlyTo,
}: {
  place: PlaceProps;
  sites: readonly Site[];
  /** When the place existed, if known (content/place-life.yaml). */
  life?: PlaceLife | undefined;
  /** The place's point, [lon, lat]: where it is today on Google Maps. */
  at: readonly [number, number];
  /** Other records on the same point under another name. */
  alsoHere: readonly PlaceProps[];
  locale: Locale;
  onSelect: (placeId: string) => void;
  year: number;
  onClose: () => void;
  onZoom: () => void;
  onFlyTo: (at: readonly [number, number]) => void;
}) {
  // Opened lists stay open for this place; the card is keyed by place, so a new place
  // starts folded again.
  // Verses open fifty at a time: Jerusalem has 955.
  const [versesShown, setVersesShown] = useState(VERSES_SHOWN);
  // After "ещё N", keyboard focus moves to the first verse that appeared.
  const versesRef = useRef<HTMLDivElement>(null);
  const focusVerse = useRef<number | null>(null);
  useEffect(() => {
    if (focusVerse.current === null) return;
    versesRef.current?.querySelectorAll("a")[focusVerse.current]?.focus();
    focusVerse.current = null;
  }, [versesShown]);
  const [allAlso, setAllAlso] = useState(false);
  const { t } = useTranslation();
  const ru = locale === "ru";
  const title = ru ? (place.name_ru ?? place.name) : place.name;
  // A version OpenBible rates at 0 % (Khirbet Minyeh for Capernaum) is noise beside a
  // settled site: listed only while it has a share.
  const versions = sites.filter((s) => s.share !== 0);
  const kindKey = `kind.${place.kind}`;
  const kind = t(kindKey) === kindKey ? place.kind : t(kindKey);

  return (
    <Panel className="w-[380px] max-md:w-full max-h-[calc(100vh-200px)] max-md:max-h-[48dvh] overflow-auto">
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
        <div className="-mr-1 flex shrink-0 items-center gap-0.5">
          <button
            onClick={onZoom}
            aria-label={t("place.zoom")}
            title={t("place.zoom")}
            className="rounded-full p-1.5 text-accent hover:bg-paper-2"
          >
            <ZoomIn className="size-5" aria-hidden />
          </button>
          <button
            onClick={onClose}
            aria-label={t("place.close")}
            title={t("place.close")}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
        <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-xs text-ink-soft">
          {kind}
        </span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${place.disputed ? "border-[#e0b98f] bg-[#f4dfc9] text-[#7a4a1d]" : "border-line bg-paper-2 text-ink-soft"}`}
        >
          {place.disputed ? t("place.sites", { count: place.sites }) : t("place.single_site")}
        </span>
      </div>

      {versions.length > 1 && (
        <div className="mx-5 mt-4 rounded-xl border border-[#e0b98f] bg-[#fbf1e4] px-3 py-2.5">
          <div className="text-[11px] font-medium tracking-[0.12em] text-[#7a4a1d] uppercase">
            {t("place.sites_title")}
          </div>
          <ul className="mt-1.5 space-y-1">
            {versions.map((s) => (
              <li key={`${s.label}-${s.at.join(",")}`}>
                <button
                  onClick={() => {
                    onFlyTo(s.at);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-paper-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                    {ru ? (s.labelRu ?? s.label) : s.label}
                  </span>
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

      {life && (
        <div className="mx-5 mt-3 rounded-xl border border-line bg-paper-2/60 px-3 py-2 text-[13px] leading-snug text-ink">
          {/* When it stood first, then the years in ruins between its two lives. */}
          <div className="font-medium">
            {life.from && t("place.life_from", { year: lifeYear(life.from, locale, t) })}
            {life.from && life.until && " · "}
            {life.until &&
              t(life.from ? "place.life_until" : "place.life_until_only", {
                year: lifeYear(life.until, locale, t),
              })}
            {life.gap && (life.from ?? life.until) && " · "}
            {life.gap &&
              t("place.life_gap", {
                from: lifeYear(life.gap.from, locale, t),
                until: lifeYear(life.gap.until, locale, t),
              })}
          </div>
          <div className="mt-0.5">{life.note[locale] ?? life.note.en}</div>
          <div className="mt-1 text-[11px] text-ink-soft">{life.sources.join("; ")}</div>
        </div>
      )}

      {beforeItsTime(place, year) && (
        <div className="mx-5 mt-3 text-[12.5px] leading-snug text-ink-soft italic">
          {!life
            ? t("place.nt_only")
            : place.gap_from !== undefined &&
                year >= place.gap_from &&
                year < (place.gap_until ?? Infinity)
              ? t("place.in_ruins")
              : t(year < (place.life_from ?? -Infinity) ? "place.not_yet" : "place.no_longer")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-5 pt-3 text-[14px] text-ink">
        <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
        {place.where && place.where !== place.name && (
          <>
            <span className="text-ink-soft">{t("place.today")}:</span>
            <span>{ru ? (place.where_ru ?? place.where) : place.where}</span>
          </>
        )}
        <a
          href={mapsUrl(at)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {t("place.google_maps")}
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only"> ({t("new_tab")})</span>
        </a>
      </div>

      {alsoHere.length > 0 && (
        <div className="px-5 pt-2 text-[13px] leading-snug text-ink">
          <span className="text-ink-soft">{t("place.also_here")}:</span>{" "}
          {alsoHere.slice(0, allAlso ? undefined : ALSO_SHOWN).map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <button
                onClick={() => {
                  onSelect(p.id);
                }}
                className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {ru ? (p.name_ru ?? p.name) : p.name}
              </button>
            </span>
          ))}
          {!allAlso && alsoHere.length > ALSO_SHOWN && (
            <>
              {" · "}
              <button
                onClick={() => {
                  setAllAlso(true);
                }}
                className="text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {t("place.more", { count: alsoHere.length - ALSO_SHOWN })}
              </button>
            </>
          )}
        </div>
      )}

      <div className="mx-5 mt-4 flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-[11px] font-medium tracking-[0.12em] text-ink-soft uppercase">
          {t("place.verses")}
        </span>
        <span className="text-[12px] text-ink-soft tabular-nums">
          {t("place.verse_count", { count: place.verses })} · {t("place.ot")} {place.ot} ·{" "}
          {t("place.nt")} {place.nt}
        </span>
      </div>
      <div ref={versesRef} className="flex flex-wrap gap-1.5 px-5 pt-2">
        {place.osis.slice(0, versesShown).map((o) => (
          <a
            key={o}
            href={verseUrl(o, locale)}
            target="_blank"
            rel="noopener noreferrer"
            title={t("place.read_verse")}
            className="rounded-full border border-line bg-white/70 px-2.5 py-0.5 font-serif text-[13px] text-ink hover:border-accent hover:text-accent"
          >
            {safeRef(o, locale)}
            <span className="sr-only"> ({t("new_tab")})</span>
          </a>
        ))}
        {place.osis.length > versesShown && (
          <button
            onClick={() => {
              focusVerse.current = versesShown;
              setVersesShown(versesShown + 50);
            }}
            className="rounded-full px-2 py-0.5 text-[13px] text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            {t("place.more", { count: place.osis.length - versesShown })}
          </button>
        )}
      </div>

      <div className="px-5 pt-3 pb-4 text-[11px] text-ink-soft">
        OpenBible.info (CC BY 4.0)
        {place.coord === "wikidata" ? ` · ${t("place.coords_wikidata")}` : ""}
      </div>
    </Panel>
  );
}
