import { iconDataUrl, type LayerVisibility } from "@hg/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "./Panel";

const ORDER: (keyof LayerVisibility)[] = ["relief", "borders", "places", "routes"];

/** Map legend: the icons of places (packages/core/src/icons.ts) and what they mean. */
const LEGEND = [
  "hg-mountain",
  "hg-spring",
  "hg-tree",
  "hg-building",
  "hg-altar",
  "hg-tent",
  "hg-valley",
  "hg-road",
  "hg-river",
] as const;
const INK = "#5b4630";

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
      <Legend />
    </Section>
  );
}

function Legend() {
  const { t } = useTranslation();
  const icons = useMemo(() => LEGEND.map((name) => [name, iconDataUrl(name, INK)] as const), []);
  return (
    <div className="mx-4 mt-2 border-t border-line pt-2">
      <div className="pb-1 text-[11px] font-medium tracking-[0.12em] text-ink-soft uppercase">
        {t("legend.title")}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-ink">
        <li className="flex items-center gap-2">
          <span className="grid size-4 place-items-center" aria-hidden>
            <span className="size-2.5 rounded-full border border-paper bg-accent" />
          </span>
          {t("legend.town")}
        </li>
        <li className="flex items-center gap-2">
          <span
            className="grid size-4 place-items-center rounded-full border-[1.5px] border-accent"
            aria-hidden
          >
            <span className="size-2 rounded-full bg-accent" />
          </span>
          {t("legend.major")}
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-4 place-items-center" aria-hidden>
            <span className="size-2.5 rounded-full border border-paper bg-[#a6805c]" />
          </span>
          {t("legend.disputed")}
        </li>
        {icons.map(([name, url]) => (
          <li key={name} className="flex items-center gap-2">
            {url && <img src={url} alt="" className="size-4" />}
            {t(`legend.${name.slice(3)}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
