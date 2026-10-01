import type { LayerVisibility } from "@hg/core";
import type { Locale } from "@hg/model";
import { useState } from "react";
import { useTranslation } from "../i18n";
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
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onLocale: (l: Locale) => void;
  layers: LayerVisibility;
  onLayer: (layer: keyof LayerVisibility, visible: boolean) => void;
}) {
  const { t } = useTranslation();
  const [legend, setLegend] = useState(false);
  const row =
    "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-[14px] text-ink ring-1 ring-line hover:bg-paper-2";
  return (
    <>
      <Modal open={open && !legend} title={t("settings.title")} onClose={onClose}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">{t("settings.language")}</span>
            <div className="flex overflow-hidden rounded-full ring-1 ring-line">
              {(["ru", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    onLocale(l);
                  }}
                  aria-pressed={locale === l}
                  className={`px-4 py-1.5 text-[13px] ${locale === l ? "bg-accent text-paper" : "text-ink-soft hover:bg-paper-2"}`}
                >
                  {l === "ru" ? "Русский" : "English"}
                </button>
              ))}
            </div>
          </div>
          <LayerToggles layers={layers} onToggle={onLayer} />
          <div className="flex flex-col gap-2">
            <button
              className={row}
              onClick={() => {
                setLegend(true);
              }}
            >
              {t("legend.title")}
              <span aria-hidden>›</span>
            </button>
            <a
              className={row}
              href={`${import.meta.env.BASE_URL}about.html${locale === "en" ? "#en" : ""}`}
            >
              {t("settings.help")}
              <span aria-hidden>›</span>
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
