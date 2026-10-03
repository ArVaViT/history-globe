import { iconDataUrl, type LayerVisibility } from "@hg/core";
import { useMemo } from "react";
import { useTranslation } from "../i18n";

const ORDER: (keyof LayerVisibility)[] = [
  "relief",
  "borders",
  "roads",
  "ancient",
  "battles",
  "places",
  "routes",
];

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
  "hg-battle",
] as const;
const INK = "#5b4630";

/** The map layers, each with its switch (in the settings window). */
export function LayerToggles({
  layers,
  onToggle,
  locked = [],
}: {
  layers: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility, visible: boolean) => void;
  /** Layers a setting keeps off (the Bible alone keeps the ancient world off). */
  locked?: readonly (keyof LayerVisibility)[];
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="pb-1 text-[13px] font-semibold text-ink">{t("layers.title")}</legend>
      {ORDER.map((layer) => (
        <label
          key={layer}
          className={`flex items-center justify-between py-1.5 text-[14px] text-ink ${locked.includes(layer) ? "opacity-50" : "cursor-pointer"}`}
        >
          {t(`layers.${layer}`)}
          <input
            type="checkbox"
            role="switch"
            checked={layers[layer] && !locked.includes(layer)}
            disabled={locked.includes(layer)}
            onChange={(e) => {
              onToggle(layer, e.target.checked);
            }}
            className="hg-switch"
          />
        </label>
      ))}
    </fieldset>
  );
}

/** The map key: what the dots, icons and lines mean (in a window of its own). */
export function Legend() {
  const icons = useMemo(() => LEGEND.map((name) => [name, iconDataUrl(name, INK)] as const), []);
  const { t } = useTranslation();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px] text-ink">
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
          <span className="size-2.5 rounded-full border-[1.5px] border-accent bg-paper" />
        </span>
        {t("legend.disputed")}
      </li>
      <li className="flex items-center gap-2">
        <span className="grid size-4 place-items-center" aria-hidden>
          <span className="size-2.5 rounded-full bg-accent opacity-35" />
        </span>
        {t("legend.faded")}
      </li>
      <li className="flex items-center gap-2">
        <span className="grid size-4 place-items-center" aria-hidden>
          <span className="size-2.5 rounded-full border-[1.5px] border-[#5d6570]" />
        </span>
        {t("legend.ancient")}
      </li>
      {icons.map(([name, url]) => (
        <li key={name} className="flex items-center gap-2">
          {url && <img src={url} alt="" className="size-4" />}
          {t(`legend.${name.slice(3)}`)}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="w-4 border-t-2 border-dashed border-[#7a5228]" aria-hidden />
        {t("legend.roman_road")}
      </li>
      <li className="flex items-center gap-2">
        <span className="w-4 border-t-2 border-dashed border-accent" aria-hidden />
        {t("legend.route")}
      </li>
    </ul>
  );
}
