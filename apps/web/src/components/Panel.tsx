import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-paper/92 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

function readOpen(id: string): boolean {
  try {
    return localStorage.getItem(`hg:closed:${id}`) === null;
  } catch {
    return true;
  }
}

function writeOpen(id: string, open: boolean): void {
  try {
    if (open) localStorage.removeItem(`hg:closed:${id}`);
    else localStorage.setItem(`hg:closed:${id}`, "1");
  } catch {
    // Private windows may refuse storage: the panel still toggles, it just forgets.
  }
}

/** A panel whose title folds it away; the choice is remembered in this browser. */
export function Section({
  id,
  title,
  className = "",
  children,
}: {
  id: string;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id));
  return (
    <Panel className={open ? className : `${className} !pb-0`}>
      <button
        onClick={() => {
          setOpen(!open);
          writeOpen(id, !open);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 pt-3 pb-1 text-[11px] font-medium tracking-[0.12em] text-ink-soft uppercase hover:text-ink [&:last-child]:pb-3"
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
