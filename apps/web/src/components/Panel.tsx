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
      className={`rounded-[20px] border border-line bg-paper/92 shadow-panel backdrop-blur-xl backdrop-saturate-150 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A part of the overview panel: its tab names it, so only the content shows. Tours,
 * events, people and articles each fill one tab.
 */
export function Section({ children }: { children: ReactNode }) {
  return <div className="pt-2 pb-2">{children}</div>;
}
