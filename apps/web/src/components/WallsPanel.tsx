import { moveOutline, outlineCentre, outlineSize, type LonLat } from "@hg/core";
import type { Locale } from "@hg/model";
import { useEffect, useRef, useState } from "react";
import { DATA_URL } from "../data";
import { useTranslation } from "../i18n";
import { X } from "./icons";
import { Panel } from "./Panel";

interface Outline {
  readonly id: string;
  readonly name: Readonly<Record<string, string>>;
  readonly accuracy: number;
  readonly ring: readonly LonLat[];
}

let walls: Promise<Outline[]> | null = null;
/** Jerusalem's walls in three periods (content/jerusalem-walls.geojson), loaded once. */
function loadWalls(): Promise<Outline[]> {
  walls ??= fetch(`${DATA_URL}/walls.geojson`)
    .then((r) => {
      if (!r.ok) throw new Error(`walls: ${String(r.status)}`);
      return r.json() as Promise<{
        features: {
          properties: { id: string; name_en: string; name_ru: string; accuracy_m: number };
          geometry: { coordinates: [number, number][][] };
        }[];
      }>;
    })
    .then((g) =>
      g.features.map((f) => ({
        id: f.properties.id,
        name: { en: f.properties.name_en, ru: f.properties.name_ru },
        accuracy: f.properties.accuracy_m,
        ring: (f.geometry.coordinates[0] ?? []).map(([x, y]) => [x, y] as const),
      })),
    )
    .catch((e: unknown) => {
      walls = null;
      throw e;
    });
  return walls;
}

/**
 * Jerusalem's walls laid over another place at their true size — over Babylon, Rome, or
 * where the reader is — to see how small (or large) the city was. The outline stays where
 * it is put while the map moves; closing the panel takes it away.
 */
export function WallsPanel({
  renderer,
  locale,
  onClose,
}: {
  renderer: {
    readonly setOutline?: (ring: readonly LonLat[] | null) => void;
    readonly getCamera: () => { readonly center: LonLat; readonly zoom: number };
    readonly flyTo: (target: { center: LonLat; zoom?: number }) => void;
  };
  locale: Locale;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [outlines, setOutlines] = useState<Outline[] | null>(null);
  const [chosen, setChosen] = useState("jerusalem-herodian-30ce");
  // Where the outline's middle stands: the map's middle when the panel opens.
  // Null: in Jerusalem, each outline where it stood.
  const [at, setAt] = useState<LonLat | null>(() => renderer.getCamera().center);
  const [noPlace, setNoPlace] = useState(false);
  const [failed, setFailed] = useState(false);
  // On a phone the panel covers half the map: once the walls are placed it folds to a line.
  const [folded, setFolded] = useState(false);
  const placed = () => {
    if (matchMedia("(max-width: 767px)").matches) setFolded(true);
  };
  useEffect(() => {
    let live = true;
    loadWalls().then(
      (o) => {
        if (!live) return;
        setOutlines(o);
        // Opened over Jerusalem itself: the walls stand where they stood, not shifted to
        // the middle of the screen.
        const home = o[0] ? outlineCentre(o[0].ring) : null;
        const [x, y] = renderer.getCamera().center;
        if (home && Math.hypot((x - home[0]) * 0.85, y - home[1]) < 0.05) setAt(null);
        // Opened over a country, or over Jerusalem as a card shows it, the walls are a
        // speck: come down to a town's scale.
        if (renderer.getCamera().zoom < 11) renderer.flyTo({ center: [x, y], zoom: 13 });
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [renderer]);
  const outline = outlines?.find((o) => o.id === chosen) ?? outlines?.[0];
  useEffect(() => {
    if (outline) renderer.setOutline?.(at ? moveOutline(outline.ring, at) : outline.ring);
  }, [renderer, outline, at]);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      renderer.setOutline?.(null);
    };
  }, [renderer]);
  const size = outline ? outlineSize(outline.ring) : null;
  const n = (v: number, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);
  const action =
    "text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid";
  if (folded && outline && size)
    return (
      <Panel className="w-[340px] max-md:w-full px-4 py-2">
        <div className="flex items-center justify-between gap-2 text-[13px] text-ink">
          <button
            className="min-w-0 truncate text-left underline decoration-dotted underline-offset-2"
            onClick={() => {
              setFolded(false);
            }}
          >
            {t("walls.title")} ·{" "}
            {t("walls.size", { ha: n(size.area / 1e4), km: n(size.perimeter / 1000, 1) })}
          </button>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      </Panel>
    );
  return (
    <Panel className="w-[340px] max-md:w-full px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-[17px] font-semibold text-ink">{t("walls.title")}</h2>
        <button
          onClick={onClose}
          aria-label={t("close")}
          className="-mt-0.5 rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-[13px] text-ink-soft">
        {failed ? t("walls.failed") : t("walls.intro")}
      </p>
      {outlines && (
        <fieldset className="mt-2">
          <legend className="sr-only">{t("walls.title")}</legend>
          {outlines.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 py-1 text-[14px] text-ink"
            >
              <input
                type="radio"
                name="walls"
                checked={o.id === outline?.id}
                onChange={() => {
                  setChosen(o.id);
                }}
                className="accent-[var(--color-accent)]"
              />
              {o.name[locale] ?? o.name.en}
            </label>
          ))}
        </fieldset>
      )}
      {size && (
        <p className="mt-1 text-[13px] text-ink tabular-nums">
          {t("walls.size", { ha: n(size.area / 1e4), km: n(size.perimeter / 1000, 1) })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <button
          className={action}
          onClick={() => {
            setAt(renderer.getCamera().center);
            placed();
          }}
        >
          {t("walls.here")}
        </button>
        <button
          className={action}
          onClick={() => {
            setNoPlace(false);
            navigator.geolocation.getCurrentPosition(
              (p) => {
                // The answer may come after the panel closed: then the map stays put.
                if (!open.current) return;
                const me: LonLat = [p.coords.longitude, p.coords.latitude];
                setAt(me);
                placed();
                renderer.flyTo({ center: me, zoom: 13.5 });
              },
              () => {
                if (open.current) setNoPlace(true);
              },
              { timeout: 10000 },
            );
          }}
        >
          {t("walls.me")}
        </button>
        {outline && (
          <button
            className={action}
            onClick={() => {
              const home = outlineCentre(outline.ring);
              setAt(null);
              placed();
              renderer.flyTo({ center: home, zoom: 14 });
            }}
          >
            {t("walls.home")}
          </button>
        )}
      </div>
      {noPlace && <p className="mt-1 text-[12px] text-ink-soft">{t("walls.no_place")}</p>}
      {outline && (
        <p className="mt-2 text-[11.5px] text-ink-soft">
          {t("walls.source", { m: n(outline.accuracy) })}
        </p>
      )}
    </Panel>
  );
}
