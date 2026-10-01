import { ChevronDown } from "./icons";
import { useState, type ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] border border-white/45 bg-paper/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_24px_-12px_rgba(20,14,8,0.55)] backdrop-blur-xl backdrop-saturate-150 ${className}`}
    >
      {children}
    </div>
  );
}

function readOpen(id: string, byDefault: boolean): boolean {
  try {
    const v =
      localStorage.getItem(`hg:panel:${id}`) ?? (localStorage.getItem(`hg:closed:${id}`) && "0");
    return v === null ? byDefault : v === "1";
  } catch {
    return byDefault;
  }
}

function writeOpen(id: string, open: boolean): void {
  try {
    localStorage.setItem(`hg:panel:${id}`, open ? "1" : "0");
    localStorage.removeItem(`hg:closed:${id}`);
  } catch {
    // Private windows may refuse storage: the panel still toggles, it just forgets.
  }
}

/** A panel whose title folds it away; the choice is remembered in this browser. */
export function Section({
  id,
  title,
  className = "",
  defaultOpen = true,
  children,
}: {
  id: string;
  title: ReactNode;
  className?: string;
  /** Open until the reader folds it; false for panels one opens on purpose (the key). */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  return (
    <Panel className={open ? className : `${className} !pb-0`}>
      <button
        onClick={() => {
          setOpen(!open);
          writeOpen(id, !open);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 pt-3 pb-1 text-[13px] font-semibold text-ink hover:text-accent [&:last-child]:pb-3"
      >
        {title}
        <ChevronDown
          className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden
        />
      </button>
      {open && children}
    </Panel>
  );
}
