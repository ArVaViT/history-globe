import type { LayerVisibility } from "@hg/core";
import type { Locale } from "@hg/model";
import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import { canSave, saveOffline, saveSize, type SaveProgress } from "../offline";
import { LayerToggles, Legend } from "./LayersPanel";
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
  // Plain rows under a hairline: lighter than the settings above them.
  const row =
    "-mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-[14px] text-ink hover:bg-paper-2";
  return (
    <>
      <Modal open={open && !legend} title={t("settings.title")} onClose={onClose}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">{t("settings.language")}</span>
            <div className="flex rounded-full bg-paper-2 p-0.5">
              {(["ru", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    onLocale(l);
                  }}
                  aria-pressed={locale === l}
                  className={`rounded-full px-3.5 py-1 text-[13px] transition ${locale === l ? "bg-paper font-medium text-ink shadow-[0_1px_3px_rgba(20,14,8,0.18)]" : "text-ink-soft hover:text-ink"}`}
                >
                  {l === "ru" ? "Русский" : "English"}
                </button>
              ))}
            </div>
          </div>
          <LayerToggles layers={layers} onToggle={onLayer} locked={bibleOnly ? ["ancient"] : []} />
          <label className="flex cursor-pointer items-start justify-between gap-4 text-[14px] text-ink">
            <span>
              {t("settings.bible_only")}
              <span className="mt-0.5 block text-[12px] text-ink-soft">
                {t("settings.bible_only_hint")}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={bibleOnly}
              onChange={(e) => {
                onBibleOnly(e.target.checked);
              }}
              className="hg-switch mt-0.5"
            />
          </label>
          {canSave() && <OfflineSave locale={locale} />}
          <div className="flex flex-col border-t border-line pt-2">
            <button
              className={row}
              onClick={() => {
                setLegend(true);
              }}
            >
              {t("legend.title")}
              <span className="text-ink-soft" aria-hidden>
                ›
              </span>
            </button>
            <a
              className={row}
              href={`${import.meta.env.BASE_URL}docs/${locale === "ru" ? "ru/" : ""}`}
            >
              {t("settings.help")}
              <span className="text-ink-soft" aria-hidden>
                ›
              </span>
            </a>
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
function OfflineSave({ locale }: { locale: Locale }) {
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
  return (
    <div className="flex items-start justify-between gap-4 text-[14px] text-ink">
      <span>
        {t("settings.offline")}
        <span className="mt-0.5 block text-[12px] text-ink-soft" aria-live="polite">
          {progress?.state === "saving"
            ? t("settings.offline_saving", { done: progress.done, total: progress.total })
            : progress?.state === "error"
              ? t("settings.offline_error")
              : progress?.state === "saved" && progress.failed > 0
                ? t("settings.offline_partly", { n: progress.failed })
                : date
                  ? t("settings.offline_saved", { date })
                  : t("settings.offline_hint")}
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
        className="shrink-0 rounded-full border border-line px-3 py-1 text-[13px] text-ink hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {date ? t("settings.offline_again") : t("settings.offline_save", { mb })}
      </button>
    </div>
  );
}
