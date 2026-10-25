import type { ReactNode } from "react";

/**
 * Names in a credit line that link to their source: STEP Bible asks to be credited as
 * "STEP Bible" linked to www.STEPBible.org, and CC BY for a link to the licence.
 */
const LINKS: readonly (readonly [string, string])[] = [
  ["STEP Bible", "https://www.STEPBible.org"],
  ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
];

/** A credit line with the names it carries linked; the words around them stay as written. */
export function Credit({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let rest = text;
  for (;;) {
    const next = LINKS.map(([name, href]) => [rest.indexOf(name), name, href] as const)
      .filter(([at]) => at >= 0)
      .sort((a, b) => a[0] - b[0])[0];
    if (!next) break;
    const [at, name, href] = next;
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push(
      <a
        key={parts.length}
        href={href}
        target="_blank"
        rel={name.startsWith("CC ") ? "noopener noreferrer license" : "noopener noreferrer"}
        className="underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        {name}
      </a>,
    );
    rest = rest.slice(at + name.length);
  }
  if (rest) parts.push(rest);
  return <>{parts}</>;
}
