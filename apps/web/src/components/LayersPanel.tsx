import type { LayerVisibility } from "@hg/core";
import { useTranslation } from "react-i18next";
import { Section } from "./Panel";

const ORDER: (keyof LayerVisibility)[] = ["relief", "borders", "places", "routes"];

export function LayersPanel({
  layers,
  onToggle,
}: {
  layers: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility, visible: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Section id="layers" title={t("layers.title")} className="w-[340px] pb-2">
      {ORDER.map((layer) => (
        <label
          key={layer}
          className="flex cursor-pointer items-center justify-between px-4 py-1.5 text-[14px] text-ink"
        >
          {t(`layers.${layer}`)}
          <input
            type="checkbox"
            checked={layers[layer]}
            onChange={(e) => {
              onToggle(layer, e.target.checked);
            }}
            className="size-4 accent-accent"
          />
        </label>
      ))}
    </Section>
  );
}
