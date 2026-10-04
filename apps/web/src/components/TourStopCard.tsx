import type { LonLat, Tour } from "@hg/core";
import { formatRef, type Locale, placeName } from "@hg/model";
import { ArrowLeft, ArrowRight, X } from "./icons";
import { useTranslation } from "../i18n";
import type { PlaceProps } from "../data";
import { Panel } from "./Panel";
import { verseUrl } from "../links";
import { distanceKm, roundKm, routeKm, walkTime } from "../distance";
import { isVoyage, profileShape, romanLeg } from "../leg";
import type { PlacePhoto } from "@hg/model";
import { Photo } from "./Photo";
import { useEffect, useState } from "react";
import { loadVerse } from "../verses";
import { DATA_URL } from "../data";

export function TourStopCard({
  tour,
  step,
  place,
  locale,
  onStep,
  onClose,
  onOpenPlace,
  stopName,
  photo,
  heights,
  profileAlong,
  compact,
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
  /** The stop's place photo, if it has one (hidden on a phone, where the card is short). */
  photo?: PlacePhoto | undefined;
  /** Each stop's height above sea level from the relief (null where unknown), once read. */
  heights?: readonly (number | null)[] | undefined;
  /** Reads heights along a way (the renderer's): the relief of the leg from the stop before. */
  profileAlong?: ProfileAlong | undefined;
  /** In a short frame (embedded): no row of stop dots; Back and Next do the stepping. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const roads = useRoadLegs();
  const leg = useLegProfile(tour, step, profileAlong);
  const profile = leg?.values;
  const stop = tour.stops[step];
  if (!stop) return null;
  const name = place ? placeName(place, locale) : stop.placeId;
  const last = tour.stops.length - 1;
  // How far this stop is from the one before, or, at the start, how long the route is:
  // in a straight line, the only distance the data can vouch for.
  const prev = step > 0 ? tour.stops[step - 1] : undefined;
  const km = (n: number) => new Intl.NumberFormat(locale).format(roundKm(n));
  const fromPrev = prev ? distanceKm(prev.at, stop.at) : 0;
  const total = step === 0 ? routeKm(tour.stops.map((s) => s.at)) : 0;
  const distance =
    prev && fromPrev >= 2
      ? t("tours.distance_from", { km: km(fromPrev), from: stopName(prev.placeId) })
      : total >= 2
        ? t("tours.distance_total", { km: km(total) })
        : null;
  // Up or down from the last stop, from the relief at the two places (not the road between):
  // "going up to Jerusalem" in numbers. Only differences a walker would feel; heights to
  // 10 m, the relief's own precision.
  const m = (n: number) =>
    // `|| 0`: a height of −1 to −5 m rounds to −0.
    new Intl.NumberFormat(locale).format(Math.round(n / 10) * 10 || 0).replace("-", "−");
  const here = heights?.[step];
  const before = step > 0 ? heights?.[step - 1] : undefined;
  // A voyage climbs nothing: an island's point (Samos) stands on its hill, not its harbour.
  const climb =
    !stop.sea &&
    !stop.untold &&
    tour.walked !== false &&
    !(profile && isVoyage(profile)) &&
    here != null &&
    before != null &&
    Math.abs(here - before) >= 100
      ? t(here > before ? "tours.higher" : "tours.lower", { m: m(Math.abs(here - before)) })
      : null;
  // On foot, if the leg is a walk: known once the relief along it is read (at sea it is
  // blank), so a voyage never shows days of walking for a moment. Along the Roman roads
  // when the leg has a way by them (road-legs.json), else in a straight line.
  // The tour's own leg, or the same two places walked in another tour (a lesson's legs).
  const pairs = roads?.["@pairs"] as Readonly<Record<string, number>> | undefined;
  const road =
    (roads?.[tour.id] as readonly (number | null)[] | undefined)?.[step] ??
    (prev && romanLeg(tour, step) ? pairs?.[`${prev.placeId}>${stop.placeId}`] : undefined) ??
    null;
  const walk =
    prev &&
    fromPrev >= 2 &&
    !stop.sea &&
    !stop.untold &&
    tour.walked !== false &&
    profile &&
    !isVoyage(profile)
      ? (() => {
          const w = walkTime(road ?? fromPrev);
          const time =
            "hours" in w
              ? t("place.walk_hours", { n: w.hours })
              : t("place.walk_days", { count: w.days });
          return road
            ? t("tours.walk_road", { km: km(road), walk: time })
            : t("tours.walk", { walk: time });
        })()
      : null;
  // The dot stays with the part before it: a line never starts with one.
  // At sea no speed is guessed: the days only where the text gives them (Acts 20:6).
  const sea = stop.sailed
    ? t("tours.sailed", {
        count: stop.sailed.days,
        about: stop.sailed.about ? "≈\u00a0" : "",
        ref: formatRef(stop.sailed.ref, locale).replace(" ", "\u00a0"),
      })
    : t("tours.by_sea");
  const line = [distance, stop.sea ? sea : stop.untold ? t("tours.untold") : walk, climb]
    .filter(Boolean)
    .join("\u00a0· ");
  // Capitals of different ages (the empires) are no way walked: no relief between them.
  const shape =
    profile && !stop.sea && !stop.untold && tour.walked !== false && !isVoyage(profile)
      ? profileShape(profile, 320, 44)
      : null;

  return (
    <Panel className="w-[min(420px,calc(100vw-376px-32px))] max-md:w-full px-5 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-ink-soft">
          {/* Where we are is the dots below; screen readers hear it in the live region. */}
          {tour.title[locale] ?? tour.title.en}
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
        {line && <p className="mt-0.5 text-[12px] text-ink-soft">{line}</p>}
        {shape && prev && (
          <LegProfile
            shape={shape}
            locale={locale}
            from={stopName(prev.placeId)}
            to={name}
            road={leg?.road ?? false}
          />
        )}
        {stop.note[locale] || stop.note.en ? (
          <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink">
            {stop.note[locale] || stop.note.en}
          </p>
        ) : (
          // A stop without a note (a teacher's lesson): the verse that names the place.
          <StopVerse key={stop.ref} osis={stop.ref} locale={locale} />
        )}
      </div>
      {/* Outside the live region: the credit is not read out at every stop. */}
      {photo && (
        <Photo
          key={stop.placeId}
          photo={photo}
          placeId={stop.placeId}
          title={name}
          className="mt-3 max-md:hidden"
          aspect="aspect-[21/9]"
        />
      )}
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
        {compact ? (
          // A short frame: the stepping beside the verse, in one row.
          <span className="ml-auto flex items-center gap-1">
            <button
              disabled={step === 0}
              onClick={() => {
                onStep(step - 1);
              }}
              aria-label={t("tours.prev")}
              title={t("tours.prev")}
              className="grid size-8 place-items-center rounded-full text-ink-soft enabled:hover:bg-paper-2 disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              onClick={() => {
                if (step < last) onStep(step + 1);
                else onClose();
              }}
              className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-sm text-paper hover:brightness-110"
            >
              {step < last ? t("tours.next") : t("tours.close")}
              {step < last && <ArrowRight className="size-4" />}
            </button>
          </span>
        ) : (
          <button
            onClick={() => {
              onOpenPlace(stop.placeId);
            }}
            className="ml-auto text-[13px] text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {t("tours.about_place")}
          </button>
        )}
      </div>
      {/* One dot per stop: where we are, and a jump to any stop. */}
      <ol
        className={`mt-4 flex flex-wrap items-center gap-1 ${compact ? "hidden" : ""}`}
        aria-label={t("tours.stops_list")}
      >
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
      <div className={`mt-3 flex justify-between ${compact ? "hidden" : ""}`}>
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

/**
 * The relief along the leg, in a straight line from the stop before: where the way climbs
 * over a ridge or goes down into a valley, which the two heights alone do not tell.
 */
function LegProfile({
  shape,
  locale,
  from,
  to,
  road,
}: {
  shape: NonNullable<ReturnType<typeof profileShape>>;
  locale: Locale;
  from: string;
  to: string;
  /** Read along the Roman road, not the straight line: the captions say which. */
  road: boolean;
}) {
  const { t } = useTranslation();
  const m = (n: number) =>
    new Intl.NumberFormat(locale).format(Math.round(n / 10) * 10 || 0).replace("-", "−");
  const peak = shape.peak;
  const note = peak
    ? t(`tours.profile_${peak.kind}${road ? "_road" : ""}`, { m: m(peak.m) })
    : null;
  return (
    <figure className="relative mt-2">
      {peak && (
        <span
          aria-hidden
          className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-paper bg-accent"
          style={{ left: `${String(peak.at * 100)}%`, top: `${String((peak.y / 44) * 2.75)}rem` }}
        />
      )}
      <svg
        viewBox="0 0 320 44"
        preserveAspectRatio="none"
        role="img"
        aria-label={[t(road ? "tours.profile_road" : "tours.profile", { from, to }), note]
          .filter(Boolean)
          .join(". ")}
        className="block h-11 w-full overflow-visible"
      >
        <path d={shape.area} className="fill-accent/10" />
        {shape.sea !== null && (
          <line
            x1="0"
            x2="320"
            y1={shape.sea}
            y2={shape.sea}
            className="stroke-ink-soft/40"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={shape.line}
          className="fill-none stroke-accent"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {note && (
        <figcaption
          className="mt-0.5 text-[11.5px] text-ink-soft"
          // Under the point it names, as far as one line (about 20 em) allows: on a
          // phone's narrow card it moves left to stay whole.
          style={{
            paddingLeft: `max(0px, min(${String(Math.min(Math.max(peak?.at ?? 0, 0), 0.4) * 100)}%, 100% - 20em))`,
          }}
        >
          {note}
        </figcaption>
      )}
    </figure>
  );
}

/** The text of a stop's verse, in the reader's language, when the stop has no note. */
function StopVerse({ osis, locale }: { osis: string; locale: Locale }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadVerse(osis, locale).then(
      (v) => {
        if (live) setText(v ?? null);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [osis, locale]);
  return text ? (
    <blockquote className="mt-2 border-l-2 border-accent/60 pl-3 font-serif text-[15.5px] leading-relaxed text-ink">
      {text}
    </blockquote>
  ) : null;
}

type Heights = readonly (number | null)[];
type ProfileAlong = (path: readonly LonLat[], n: number) => Promise<Heights>;
/** Heights read along a leg for its profile (leg.ts draws them). */
const LEG_SAMPLES = 48;
let roadPaths: Promise<Readonly<Record<string, LonLat[]>>> | null = null;
const legs = new Map<string, Promise<{ values: Heights; road: boolean }>>();
/**
 * The relief of a leg, read once: along the Roman road when the leg is walked by one
 * (road-paths.json, scripts/build-road-legs.ts), else along the straight line.
 */
function legProfile(
  a: { placeId: string; at: LonLat },
  b: { placeId: string; at: LonLat },
  byRoad: boolean,
  along: ProfileAlong,
) {
  const key = `${a.placeId}>${b.placeId}${byRoad ? "" : "~"}`;
  let got = legs.get(key);
  if (!got) {
    roadPaths ??= fetch(`${DATA_URL}/road-paths.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`road-paths: ${String(r.status)}`);
        return r.json() as Promise<Record<string, LonLat[]>>;
      })
      .catch((e: unknown) => {
        roadPaths = null;
        throw e;
      });
    const read = (way: LonLat[] | null) =>
      along(way ?? [a.at, b.at], LEG_SAMPLES).then((values) => ({ values, road: way !== null }));
    got = byRoad
      ? roadPaths.then(
          (paths) => {
            const back = paths[`${b.placeId}>${a.placeId}`];
            return read(paths[`${a.placeId}>${b.placeId}`] ?? (back ? [...back].reverse() : null));
          },
          // The ways did not load: the straight line for now, not kept, so the next
          // reading tries the road again.
          () => {
            legs.delete(key);
            return read(null);
          },
        )
      : read(null);
    got.catch(() => legs.delete(key));
    legs.set(key, got);
  }
  return got;
}
const legKey = (tour: Tour, i: number) =>
  `${tour.id}:${String(i)}:${tour.stops[i - 1]?.placeId ?? ""}>${tour.stops[i]?.placeId ?? ""}`;
/** The relief of the leg to this stop, read here; the next leg's is read ahead. */
function useLegProfile(tour: Tour, step: number, along: ProfileAlong | undefined) {
  const [leg, setLeg] = useState<{ key: string; values: Heights; road: boolean } | null>(null);
  useEffect(() => {
    if (!along) return;
    let live = true;
    const read = (i: number) => {
      const a = tour.stops[i - 1];
      const b = tour.stops[i];
      return a && b
        ? legProfile(a, b, tour.walked !== false && !b.sea && romanLeg(tour, i), along)
        : null;
    };
    const key = legKey(tour, step);
    read(step)?.then(
      (p) => {
        // The same leg read again keeps its state: no new render.
        if (live) setLeg((old) => (old?.key === key ? old : { key, ...p }));
      },
      () => undefined,
    );
    read(step + 1)?.catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tour, step, along]);
  return leg?.key === legKey(tour, step) ? leg : null;
}

type RoadLegs = Readonly<Record<string, unknown>>;
let roadLegs: Promise<RoadLegs> | null = null;
/** The legs' lengths along the Roman roads (scripts/build-road-legs.ts), loaded once. */
function useRoadLegs(): RoadLegs | null {
  const [legs, setLegs] = useState<RoadLegs | null>(null);
  useEffect(() => {
    let live = true;
    roadLegs ??= fetch(`${DATA_URL}/road-legs.json`)
      .then((r) => (r.ok ? (r.json() as Promise<RoadLegs>) : {}))
      .catch(() => {
        roadLegs = null;
        return {};
      });
    void roadLegs.then((v) => {
      if (live) setLegs(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return legs;
}
