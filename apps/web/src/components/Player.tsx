import { formatYear, periodAt, periodName } from "@hg/model";
import { useRef, type ComponentProps } from "react";
import { useHeightVar } from "../app-hooks";
import { focusNextFrame } from "../focus";
import { useTranslation } from "../i18n";
import { ChevronDown } from "./icons";
import { Timeline } from "./Timeline";

type TimelineProps = ComponentProps<typeof Timeline>;

/**
 * The player at the foot of the map: the timeline, or, folded to its year (embedded, or
 * sideways under a card), a pill that opens it again; the screen is then for the map. The
 * focus follows: from the pill to the slider it opens, and back to the pill when it folds.
 * Its height is --hg-timeline-h, which the column, the card and the map's padding keep clear.
 */
export function Player({
  folded,
  onOpen,
  onFold,
  ...timeline
}: Omit<TimelineProps, "rangeRef" | "onCollapse"> & {
  folded: boolean;
  onOpen: () => void;
  onFold: () => void;
}) {
  const { t } = useTranslation();
  const box = useHeightVar("--hg-timeline-h");
  const foldButton = useRef<HTMLButtonElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const { year, locale } = timeline;
  const period = periodAt(year);
  return (
    <section
      aria-label={t("time.timeline")}
      ref={box}
      className={`absolute inset-x-4 bottom-4 max-md:inset-x-3 max-md:bottom-3 ${folded ? "pointer-events-none" : ""}`}
    >
      {folded && (
        <button
          ref={foldButton}
          onClick={() => {
            onOpen();
            // The button goes; the focus moves to the slider it opened.
            focusNextFrame(range);
          }}
          aria-label={`${formatYear(year, locale).replace(/\.$/, "")}. ${t("time.expand")}`}
          aria-expanded={false}
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/45 bg-paper/90 py-1.5 pr-3 pl-4 shadow-chip backdrop-blur-xl hover:bg-paper"
        >
          <span className="font-serif text-[17px] font-semibold text-ink tabular-nums">
            {formatYear(year, locale)}
          </span>
          {period && (
            <span className="text-[12.5px] text-ink-soft max-[360px]:hidden">
              {periodName(period, locale)}
            </span>
          )}
          <ChevronDown className="size-4 rotate-180 text-ink-soft" />
        </button>
      )}
      <div className={folded ? "hidden" : undefined}>
        <Timeline
          {...timeline}
          rangeRef={range}
          onCollapse={() => {
            onFold();
            focusNextFrame(foldButton);
          }}
        />
      </div>
    </section>
  );
}
