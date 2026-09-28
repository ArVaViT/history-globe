import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-paper/92 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-[0.12em] text-ink-soft uppercase">
      {children}
    </div>
  );
}
