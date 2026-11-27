// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import {
  lazy,
  Suspense,
  useRef,
  type ComponentProps,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { useTranslation } from "../i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { BookOpen, PencilRuler, Search, Settings, X } from "./icons";
import { Panel } from "./Panel";

// The search opens on a press: its code (and the people's and sites' lookups) waits for it.
const SearchBox = lazy(() => import("./SearchBox").then((m) => ({ default: m.SearchBox })));

/**
 * The column's header, on a panel, not on the map: state labels run under the corner. The
 * magnifier, the title, the overview (it opens just below), the tools and the settings;
 * searching, the field takes the whole bar.
 */
export function Header({
  search,
  searchOpen,
  inputRef,
  searchButton,
  overviewButton,
  onSearch,
  onSearchClose,
  overviewOpen,
  onOverview,
  tools,
  onSettings,
}: {
  /** What the search finds and what it does with it (SearchBox). */
  search: Omit<ComponentProps<typeof SearchBox>, "inputRef" | "takeTyped" | "onClose">;
  searchOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  searchButton: Ref<HTMLButtonElement>;
  overviewButton: Ref<HTMLButtonElement>;
  onSearch: () => void;
  /** The search closed: the focus goes back to the magnifier when the reader closed it. */
  onSearchClose: (focusBack: boolean) => void;
  overviewOpen: boolean;
  onOverview: () => void;
  /** The tools' button, where the tools are offered (not inside another site's frame). */
  tools: { readonly open: boolean; readonly onToggle: () => void } | null;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  /** What was typed into the search before it loaded: it carries on from there. */
  const typed = useRef("");
  return (
    <Panel className="relative z-10 flex w-[360px] items-center gap-0.5 px-1.5 py-1.5 max-md:w-full">
      <h1
        className={`order-2 flex-1 pl-1 font-serif text-[19px] font-semibold tracking-tight text-ink ${searchOpen ? "sr-only" : ""}`}
      >
        History Globe
      </h1>
      {searchOpen ? (
        <>
          <ErrorBoundary fallback={null}>
            <Suspense
              fallback={
                // While the search loads: a field that keeps what is typed into it.
                <input
                  autoFocus
                  aria-label={t("search.placeholder")}
                  placeholder={t("search.placeholder")}
                  onChange={(e) => {
                    typed.current = e.target.value;
                  }}
                  className="hg-grow w-full min-w-0 rounded-full bg-paper px-3 py-1.5 pl-9 text-[15px] text-ink outline-hidden ring-2 ring-accent/30 placeholder:text-[14px] placeholder:text-ink-soft/70"
                />
              }
            >
              <SearchBox
                {...search}
                inputRef={inputRef}
                takeTyped={() => {
                  const early = typed.current;
                  typed.current = "";
                  return early;
                }}
                onClose={(focusBack) => {
                  typed.current = "";
                  onSearchClose(focusBack);
                }}
              />
            </Suspense>
          </ErrorBoundary>
          <span className="order-3">
            <HeaderButton
              label={t("search.close")}
              onClick={() => {
                onSearchClose(true);
              }}
            >
              <X className="size-[18px]" />
            </HeaderButton>
          </span>
        </>
      ) : (
        <>
          <span className="order-1">
            <HeaderButton buttonRef={searchButton} label={t("search.open")} onClick={onSearch}>
              <Search className="size-[18px]" />
            </HeaderButton>
          </span>
          <span className="order-3 flex">
            {/* The overview opens right below: tours, events, people and articles. */}
            <HeaderButton
              buttonRef={overviewButton}
              label={t("more")}
              active={overviewOpen}
              expanded={overviewOpen}
              controls="more-panels"
              onClick={onOverview}
            >
              <BookOpen className="size-[18px]" />
            </HeaderButton>
            {tools && (
              <HeaderButton
                label={t("tools.title")}
                active={tools.open}
                expanded={tools.open}
                controls="tools-panel"
                onClick={tools.onToggle}
              >
                <PencilRuler className="size-[18px]" />
              </HeaderButton>
            )}
            <HeaderButton label={t("settings.title")} dialog onClick={onSettings}>
              <Settings className="size-[18px]" />
            </HeaderButton>
          </span>
        </>
      )}
    </Panel>
  );
}

/** A round icon button in the header; `active` marks what it has opened. */
export function HeaderButton({
  buttonRef,
  label,
  active = false,
  expanded,
  controls,
  dialog = false,
  onClick,
  children,
}: {
  buttonRef?: Ref<HTMLButtonElement>;
  label: string;
  active?: boolean;
  expanded?: boolean;
  controls?: string | undefined;
  dialog?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-haspopup={dialog ? "dialog" : undefined}
      // The ring sits inside the button: outside, it ran into the title beside it.
      className={`grid size-9 shrink-0 place-items-center rounded-full hover:bg-paper-2 hover:text-ink focus-visible:outline-offset-[-2px] ${active ? "bg-paper-2 text-accent" : "text-ink-soft"}`}
    >
      {children}
    </button>
  );
}
