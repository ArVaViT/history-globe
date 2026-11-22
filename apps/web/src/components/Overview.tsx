import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import { Panel } from "./Panel";
import { readPref, writePref } from "../storage";

export type OverviewTab = "tours" | "events" | "people" | "articles";
const TABS: readonly OverviewTab[] = ["tours", "events", "people", "articles"];

const TAB_KEY = "hg:overview-tab";
const readTab = (): OverviewTab => TABS.find((t) => t === readPref(TAB_KEY)) ?? "tours";

/**
 * Tours, events, people and articles, one tab at a time: stacked in one column they read as
 * a wall. The tab picked last is remembered.
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
    writePref(TAB_KEY, next);
    const el = tabRefs.current[next];
    if (focus) el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  // A row wider than the panel (Tagalog, Spanish, Finnish on a 320 px phone) scrolls: a
  // fade at each edge with more beyond it says so, and the tab picked last is in view.
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = row.current;
    const box = list?.parentElement;
    if (!list || !box) return;
    const mark = () => {
      const rest = list.scrollWidth - list.clientWidth - list.scrollLeft;
      box.toggleAttribute("data-more-start", list.scrollLeft > 1);
      box.toggleAttribute("data-more-end", rest > 1);
    };
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    mark();
    list.addEventListener("scroll", mark, { passive: true });
    const sizes = new ResizeObserver(mark);
    sizes.observe(list);
    return () => {
      list.removeEventListener("scroll", mark);
      sizes.disconnect();
    };
  }, []);
  return (
    <Panel className="hg-slide-left w-[360px] max-md:w-full">
      {/* No cross of its own: the book in the header opens and closes it, and four tabs
          need the room. */}
      <div id="more-panels" className="flex items-center gap-1 px-2 pt-2">
        {/* The tabs share the row evenly; a language with longer words scrolls it. On a touch
            screen the row keeps room above and below for the tabs' larger hit areas, which
            its scrolling would cut off. */}
        <div className="hg-edges flex min-w-0 flex-1">
          <div
            ref={row}
            role="tablist"
            aria-label={t("overview.title")}
            className="flex flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none] pointer-coarse:-my-[7px] pointer-coarse:py-[7px]"
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
                className={`flex-1 shrink-0 rounded-full px-2.5 py-1.5 max-[360px]:px-2 text-center text-[12px] whitespace-nowrap transition ${
                  tab === id
                    ? "bg-paper-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t(`overview.${id}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div id="overview-panel" role="tabpanel" aria-labelledby={`overview-tab-${tab}`}>
        {/* A tab whose code is still coming keeps the panel up, at its height. */}
        <Suspense fallback={<div className="h-64" />}>{panels[tab]}</Suspense>
      </div>
    </Panel>
  );
}
