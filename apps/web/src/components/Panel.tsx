import type { CSSProperties, ReactNode } from "react";

export function Panel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`rounded-[20px] border border-line bg-paper/92 shadow-[0_12px_32px_-16px_rgba(20,14,8,0.45),0_2px_6px_-2px_rgba(20,14,8,0.12)] backdrop-blur-xl backdrop-saturate-150 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A part of the overview panel: its tab names it, so only the content shows. Tours,
 * events, articles and the in-view list each fill one tab.
 */
export function Section({ children }: { children: ReactNode }) {
  return <div className="pt-2 pb-2">{children}</div>;
}
