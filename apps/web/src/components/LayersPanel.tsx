import { iconDataUrl, type LayerVisibility } from "@hg/core";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import { Check, Landmark, MapIcon, MapPin, Milestone, Mountain, Route, Swords } from "./icons";

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

const LAYER_ICONS: Record<keyof LayerVisibility, (p: { className?: string }) => ReactNode> = {
  relief: Mountain,
  borders: MapIcon,
  roads: Milestone,
  ancient: Landmark,
  battles: Swords,
  places: MapPin,
  routes: Route,
};

/** The map layers as tiles, each with its icon: on or off at a glance (in the settings). */
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
      <legend className="pb-2 text-[11px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
        {t("layers.title")}
      </legend>
      <div className="grid grid-cols-1 gap-1.5 min-[440px]:grid-cols-2">
        {ORDER.map((layer) => {
          const Icon = LAYER_ICONS[layer];
          const off = locked.includes(layer);
          const on = layers[layer] && !off;
          return (
            <label
              key={layer}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13.5px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
                off
                  ? "border-line text-ink-soft opacity-50"
                  : on
                    ? "cursor-pointer border-accent/40 bg-accent/8 text-ink"
                    : "cursor-pointer border-line text-ink-soft hover:border-ink-soft/40 hover:text-ink"
              }`}
            >
              <input
                type="checkbox"
                role="switch"
                checked={on}
                disabled={off}
                onChange={(e) => {
                  onToggle(layer, e.target.checked);
                }}
                className="sr-only"
              />
              <Icon className={`size-4 shrink-0 ${on ? "text-accent" : ""}`} />
              <span className="min-w-0 flex-1 truncate">{t(`layers.${layer}`)}</span>
              {on && <Check className="size-3.5 shrink-0 text-accent" />}
            </label>
          );
        })}
      </div>
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
