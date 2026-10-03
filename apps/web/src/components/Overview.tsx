import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import { Panel } from "./Panel";

export type OverviewTab = "tours" | "events" | "people" | "articles" | "inview";
const TABS: readonly OverviewTab[] = ["tours", "events", "people", "articles", "inview"];

function readTab(): OverviewTab {
  try {
    const v = localStorage.getItem("hg:overview-tab");
    return TABS.find((t) => t === v) ?? "tours";
  } catch {
    return "tours";
  }
}

function writeTab(tab: OverviewTab): void {
  try {
    localStorage.setItem("hg:overview-tab", tab);
  } catch {
    // Private windows may refuse storage: the tab still switches, it just forgets.
  }
}

/**
 * Tours, events, people, articles and the places in view, one at a time behind tabs: the five
 * stacked in one column read as a wall. The tab picked last is remembered.
 */
export function Overview({
  panels,
  onClose,
}: {
  panels: Readonly<Record<OverviewTab, ReactNode>>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<OverviewTab>(readTab);
  const tabRefs = useRef<Partial<Record<OverviewTab, HTMLButtonElement | null>>>({});
  const pick = (next: OverviewTab, focus = false) => {
    setTab(next);
    writeTab(next);
    if (focus) tabRefs.current[next]?.focus();
  };
  return (
    <Panel className="hg-slide-left w-[360px] max-md:w-full">
      {/* No cross of its own: the book in the header opens and closes it, and five tabs
          need the room. */}
      <div id="more-panels" className="flex items-center gap-1 px-2 pt-2">
        {/* Five tabs outrun a phone: the row scrolls, and a strip in the panel's colour
            fades its edge (a mask would fade the text, read against the map by checkers). */}
        <div className="relative flex min-w-0 flex-1">
          <div
            role="tablist"
            aria-label={t("overview.title")}
            className="flex flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none]"
            // Arrow keys move between the tabs, as in any tab list (WAI-ARIA).
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                // Only the overview: the map's own Esc would also end a tour or close a card.
                e.preventDefault();
                onClose();
                return;
              }
              const i = TABS.indexOf(tab);
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = TABS[(i + d + TABS.length) % TABS.length];
              if (next) pick(next, true);
            }}
          >
            {TABS.map((id) => (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                role="tab"
                id={`overview-tab-${id}`}
                aria-selected={tab === id}
                aria-controls="overview-panel"
                tabIndex={tab === id ? 0 : -1}
                onClick={() => {
                  pick(id);
                }}
                className={`shrink-0 rounded-full px-2.5 py-1.5 text-[12px] whitespace-nowrap transition ${
                  tab === id
                    ? "bg-paper-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t(`overview.${id}`)}
              </button>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-paper to-transparent"
          />
        </div>
      </div>
      <div id="overview-panel" role="tabpanel" aria-labelledby={`overview-tab-${tab}`}>
        {panels[tab]}
      </div>
    </Panel>
  );
}
