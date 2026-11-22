import { type Locale, formatRefOr, splitPlaces, type Segment } from "@hg/model";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { verseUrl } from "../../links";
import { loadVerse } from "../../verses";
import { loadTextPlaces } from "../../text-places";

/**
 * The text of the verse picked in the list, in the reader's language, with the chapter
 * on BibleGateway a click away.
 */
export function VerseText({
  osis,
  locale,
  self,
  placeName,
  onGoTo,
}: {
  osis: string;
  locale: Locale;
  /** The card's own place and its other names on the same point: not linked. */
  self: readonly string[];
  placeName: (id: string) => string | undefined;
  onGoTo: (placeId: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null | undefined>(undefined);
  // The verse with the other places it names as links; plain until the index is in, and
  // for good if it does not load.
  // Kept with the verse and language they were made for: after a switch of language the
  // last one's links are not shown over the new text.
  const [linked, setLinked] = useState<{ key: string; parts: readonly Segment[] } | null>(null);
  const parts = linked?.key === `${osis}|${locale}` ? linked.parts : null;
  // A new array each render: the effect follows the ids, not the array.
  const selfKey = self.join(",");
  useEffect(() => {
    let live = true;
    loadVerse(osis, locale).then(
      (v) => {
        if (!live) return;
        setText(v ?? null);
        if (v)
          loadTextPlaces(locale).then(
            (index) => {
              if (live)
                setLinked({
                  key: `${osis}|${locale}`,
                  parts: splitPlaces(v, index, selfKey.split(",")),
                });
            },
            () => undefined,
          );
      },
      () => {
        if (live) setText(null);
      },
    );
    return () => {
      live = false;
    };
  }, [osis, locale, selfKey]);
  // Under a long list of verses the text may open below the card's fold: bring it in.
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (text !== undefined) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [text]);
  return (
    <figure
      ref={box}
      id="verse-text"
      aria-live="polite"
      className="mx-5 mt-3 border-l-2 border-accent/60 pl-3"
    >
      {text === undefined ? (
        <p className="text-[13px] text-ink-soft">…</p>
      ) : (
        text && (
          <blockquote className="font-serif text-[15px] leading-snug text-ink">
            {parts && parts.some((p) => p.place)
              ? parts.map((p, i) =>
                  // A namesake of the card's place (Babylon meaning Rome) is not linked.
                  p.place && placeName(p.place) !== placeName(self[0] ?? "") ? (
                    <button
                      key={i}
                      onClick={() => {
                        if (p.place) onGoTo(p.place);
                      }}
                      title={t("place.go_to", { name: placeName(p.place) ?? p.text })}
                      className="link-accent"
                    >
                      {p.text}
                    </button>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )
              : text}
          </blockquote>
        )
      )}
      <figcaption className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[12px] text-ink-soft">
        <span>
          {formatRefOr(osis, locale)} · {t("place.verse_own")}
        </span>
        <a
          href={verseUrl(osis, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="link-soft"
        >
          {t("place.verse_open")}
          <span className="sr-only"> ({t("new_tab")})</span>
        </a>
      </figcaption>
    </figure>
  );
}
