import type { LayerVisibility } from "@hg/core";
import { docsPath, LOCALE_NAMES, LOCALES, type Locale } from "@hg/model";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import { canSave, saveOffline, saveSize, type SaveProgress } from "../offline";
import { LayerToggles, Legend } from "./LayersPanel";
import { ArrowUpRight, BookOpen, ChevronDown, ChevronRight, Download, Globe } from "./icons";
import { Modal } from "./Modal";

/** Language, layers, the map key and the help page: one window behind the gear. */
export function SettingsDialog({
  open,
  onClose,
  locale,
  onLocale,
  layers,
  onLayer,
  bibleOnly,
  onBibleOnly,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onLocale: (l: Locale) => void;
  layers: LayerVisibility;
  onLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
  /** The Bible alone: its events and places, the ancient world around them hidden. */
  bibleOnly: boolean;
  onBibleOnly: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const [legend, setLegend] = useState(false);
  // Grouped as in a system's settings: rows in rounded cards, a hairline between them.
  const card = "flex flex-col divide-y divide-line rounded-2xl border border-line bg-paper-2/45";
  const row =
    "flex min-h-11 items-center justify-between gap-4 px-3.5 py-2 text-[14px] text-ink first:rounded-t-2xl last:rounded-b-2xl";
  const link = `${row} transition hover:bg-paper-2`;
  const label = (Icon: (p: { className?: string }) => ReactNode, text: string) => (
    <span className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-ink-soft" />
      {text}
    </span>
  );
  // Pages of their own, in a new tab: the arrow says the link leaves the map.
  const page = (path: string, text: string) => (
    <a className={link} href={`${import.meta.env.BASE_URL}${path}`} target="_blank" rel="noopener">
      {text}
      <ArrowUpRight className="size-4 text-ink-soft" />
    </a>
  );
  return (
    <>
      <Modal open={open && !legend} title={t("settings.title")} onClose={onClose} wide>
        <div className="flex flex-col gap-4">
          <div className={card}>
            <label className={row}>
              {label(Globe, t("settings.language"))}
              {/* A list, not buttons: there will be many languages. */}
              <span className="relative">
                <select
                  aria-label={t("settings.language")}
                  value={locale}
                  onChange={(e) => {
                    const next = LOCALES.find((l) => l === e.target.value);
                    if (next) onLocale(next);
                  }}
                  className="cursor-pointer appearance-none rounded-full border border-line bg-paper py-1 pr-8 pl-3 text-[13px] text-ink transition hover:border-ink-soft/40"
                >
                  {LOCALES.map((l) => (
                    <option key={l} value={l} lang={l}>
                      {LOCALE_NAMES[l]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-soft" />
              </span>
            </label>
          </div>
          <LayerToggles layers={layers} onToggle={onLayer} locked={bibleOnly ? ["ancient"] : []} />
          <div className={card}>
            <label className={`${row} cursor-pointer`} title={t("settings.bible_only_hint")}>
              {label(BookOpen, t("settings.bible_only"))}
              <input
                type="checkbox"
                role="switch"
                checked={bibleOnly}
                onChange={(e) => {
                  onBibleOnly(e.target.checked);
                }}
                className="hg-switch"
              />
            </label>
            {canSave() && <OfflineSave locale={locale} className={row} />}
          </div>
          <div className={card}>
            <button
              className={link}
              onClick={() => {
                setLegend(true);
              }}
            >
              {t("legend.title")}
              <ChevronRight className="size-4 text-ink-soft" />
            </button>
            {page(docsPath(locale), t("settings.help"))}
            {page(docsPath(locale, "privacy"), t("settings.privacy"))}
          </div>
        </div>
      </Modal>
      <Modal
        open={open && legend}
        title={t("legend.title")}
        onClose={() => {
          setLegend(false);
        }}
      >
        <Legend />
      </Modal>
    </>
  );
}

const SAVED_KEY = "hg:offline-saved";

/** Save the globe for use with no network (offline.ts): the size first, then the progress. */
function OfflineSave({ locale, className }: { locale: Locale; className: string }) {
  const { t } = useTranslation();
  const [size, setSize] = useState<number | null>(null);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SAVED_KEY);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    let live = true;
    void saveSize().then((b) => {
      if (live) setSize(b);
    });
    return () => {
      live = false;
    };
  }, []);
  const mb = size === null ? "…" : new Intl.NumberFormat(locale).format(Math.round(size / 1e6));
  const date = savedAt
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(savedAt))
    : null;
  // Nothing to explain before the first save: the word and the size say it.
  const status =
    progress?.state === "saving"
      ? t("settings.offline_saving", { done: progress.done, total: progress.total })
      : progress?.state === "error"
        ? t("settings.offline_error")
        : progress?.state === "saved" && progress.failed > 0
          ? t("settings.offline_partly", { n: progress.failed })
          : date
            ? t("settings.offline_saved", { date })
            : null;
  return (
    <div className={className} title={t("settings.offline_hint")}>
      <span className="flex items-center gap-2.5">
        <Download className="size-4 shrink-0 text-ink-soft" />
        <span>
          {t("settings.offline")}
          <span className="block text-[12px] text-ink-soft empty:hidden" aria-live="polite">
            {status}
          </span>
        </span>
      </span>
      <button
        disabled={progress?.state === "saving"}
        onClick={() => {
          setProgress({ state: "saving", done: 0, total: 0 });
          void saveOffline((p) => {
            setProgress(p);
            if (p.state === "saved" && p.failed === 0) {
              const now = new Date().toISOString();
              setSavedAt(now);
              try {
                localStorage.setItem(SAVED_KEY, now);
              } catch {
                // Storage blocked: the files are saved all the same.
              }
            }
          });
        }}
        className="shrink-0 rounded-full border border-line bg-paper px-3 py-1 text-[13px] text-ink transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
      >
        {date ? t("settings.offline_again") : t("settings.offline_save", { mb })}
      </button>
    </div>
  );
}
