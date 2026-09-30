/** What a key press does on the map, or null when it belongs to the focused control. */
export type KeyAction =
  | { readonly kind: "year"; readonly delta: number }
  | { readonly kind: "play" }
  | { readonly kind: "search" }
  | { readonly kind: "close" }
  | { readonly kind: "north" }
  /** The previous or next stop of a running tour; the arrows pan the map otherwise. */
  | { readonly kind: "stop"; readonly delta: -1 | 1 };

export interface KeyInput {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** Where focus is: a text field, an editable area, a button or link, the slider, none. */
  readonly focus: "text" | "editable" | "button" | "slider" | "none";
}

export function keyAction(e: KeyInput): KeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  // Keys belong to the focused control: letters go into a field, Space presses a button.
  // Only the time slider shares its keys with the map; Escape always closes.
  if (e.focus === "text") return null;
  if (e.focus === "editable" && e.key !== "Escape") return null;
  if (e.focus === "button" && (e.key === " " || e.key === "Enter")) return null;
  const big = e.shiftKey ? 100 : 10;
  if (e.key === "[" || e.key === "{") return { kind: "year", delta: -big };
  if (e.key === "]" || e.key === "}") return { kind: "year", delta: big };
  if (e.key === " ") return { kind: "play" };
  if (e.key === "/") return { kind: "search" };
  if (e.key === "Escape") return { kind: "close" };
  if (e.key.toLowerCase() === "n") return { kind: "north" };
  // On the slider the arrows move the year.
  if (e.focus !== "slider" && e.key === "ArrowLeft") return { kind: "stop", delta: -1 };
  if (e.focus !== "slider" && e.key === "ArrowRight") return { kind: "stop", delta: 1 };
  return null;
}

/** Classifies the element that has focus for keyAction. */
export function focusOf(target: EventTarget | null): KeyInput["focus"] {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return "none";
  if (el.tagName === "INPUT") return (el as HTMLInputElement).type === "range" ? "slider" : "text";
  if (el.closest("select, textarea, [contenteditable]")) return "editable";
  if (el.closest("button, a")) return "button";
  return "none";
}
