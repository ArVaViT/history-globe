import { useEffect, useRef, useState } from "react";
import { formatRef, type Locale } from "@hg/model";
import { chapterLabel, firstVerseIn, readingOrder } from "../chapter";
import type { LoadedData } from "../data";
import { useTranslation } from "../i18n";
import { ChevronDown } from "./icons";

/**
 * A chapter's name and count as a button that opens its places in the order the text
 * names them (the embed's top bar, and the chapter chip of the globe itself).
 */
export function ChapterPicker({
  chapter,
  data,
  locale,
  selected,
  onPlace,
  className,
  inline = false,
}: {
  chapter: { readonly ref: string; readonly places: readonly string[] };
  data: LoadedData;
  locale: Locale;
  selected: string | null;
  onPlace: (id: string) => void;
  /** The button's own look (a chip in a frame, plain in a panel). */
  className: string;
  /** The list in the flow, under the button (in a column that scrolls), not floating. */
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc closes the list only, not the card behind it.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const name = (id: string) => {
    const p = data.byId.get(id)?.props;
    if (!p) return id;
    return locale === "ru" ? (p.name_ru ?? p.name) : p.name;
  };
  const ids = readingOrder(
    chapter.places,
    (id) => data.byId.get(id)?.props.osis ?? [],
    chapter.ref,
  );
  // The verse that names the place, "16:12": the book is the chip's.
  const verse = (id: string) => {
    const v = firstVerseIn(data.byId.get(id)?.props.osis ?? [], chapter.ref);
    if (!v) return "";
    try {
      return formatRef(v, locale).split(" ").pop() ?? "";
    } catch {
      return "";
    }
  };
  return (
    <div ref={box} className="pointer-events-auto relative">
      <button
        ref={button}
        onClick={() => {
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={open ? "embed-places" : undefined}
        className={className}
      >
        <span className="font-serif text-[15px] text-accent">
          {chapterLabel(chapter.ref, locale)}
        </span>
        <span className="text-[12.5px] text-ink-soft">
          {t("embed.places", { count: chapter.places.length })}
        </span>
        <ChevronDown
          className={`size-4 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul
          id="embed-places"
          className={`hg-pop hg-fade ${inline ? "mt-2 -ml-2" : "absolute top-full left-0"} mt-2 max-h-[min(320px,calc(100dvh-120px))] w-64 origin-top-left overflow-y-auto rounded-2xl border border-line bg-paper p-1.5 shadow-xl [scrollbar-width:thin]`}
        >
          {ids.map((id) => (
            <li key={id}>
              <button
                onClick={() => {
                  setOpen(false);
                  onPlace(id);
                  // The list goes: the focus returns to the chapter that opened it.
                  button.current?.focus();
                }}
                aria-current={id === selected ? "true" : undefined}
                className={`flex w-full items-baseline justify-between gap-3 rounded-xl px-3 py-1.5 text-left font-serif text-[14.5px] text-ink hover:bg-paper-2 ${id === selected ? "bg-paper-2" : ""}`}
              >
                {name(id)}
                <span className="font-sans text-[12.5px] text-ink-soft tabular-nums">
                  {verse(id)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The top of an embedded map: the chapter it shows, which opens the list of its places in
 * the order the text names them, and the way out to the whole globe at the same view.
 */
export function EmbedBar({
  focus,
  data,
  locale,
  selected,
  onPlace,
}: {
  /** The chapter picked out (`ref=`), or none; a person's places are not a chapter. */
  focus: { readonly ref: string; readonly places: readonly string[] } | null;
  data: LoadedData;
  locale: Locale;
  selected: string | null;
  onPlace: (id: string) => void;
}) {
  const { t } = useTranslation();
  const chapter = focus && !focus.ref.startsWith("person:") ? focus : null;
  const chip =
    "rounded-full border border-white/45 bg-paper/90 shadow-[0_8px_24px_-12px_rgba(20,14,8,0.55)] backdrop-blur-xl";

  return (
    <nav
      aria-label={t("embed.label")}
      className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start gap-2"
    >
      {chapter && (
        <ChapterPicker
          chapter={chapter}
          data={data}
          locale={locale}
          selected={selected}
          onPlace={onPlace}
          className={`${chip} flex items-center gap-2 py-1.5 pr-2.5 pl-4 hover:bg-paper`}
        />
      )}
      <a
        href={import.meta.env.BASE_URL}
        // The view of the moment the link is used: the URL follows the map 300 ms late.
        onClick={(e) => {
          e.currentTarget.href = `${import.meta.env.BASE_URL}?${new URLSearchParams(
            [...new URLSearchParams(window.location.search)].filter(([k]) => k !== "embed"),
          ).toString()}`;
        }}
        target="_blank"
        rel="noopener"
        className={`${chip} pointer-events-auto ml-auto px-3 py-1.5 font-serif text-[14px] text-ink hover:text-accent`}
      >
        History Globe ↗<span className="sr-only"> ({t("new_tab")})</span>
      </a>
    </nav>
  );
}
