import type { Locale } from "@hg/model";
import { useMemo } from "react";
import { useTranslation } from "../i18n";
import type { LoadedData } from "../data";
import { Section } from "./Panel";

/**
 * The places with an article (content/articles), by name: a way to find them besides
 * opening each card. A pick flies to the place and opens its card, article included.
 */
export function ArticlesPanel({
  data,
  locale,
  onPick,
}: {
  data: Pick<LoadedData, "articles" | "byId">;
  locale: Locale;
  onPick: (placeId: string) => void;
}) {
  const { t } = useTranslation();
  const places = useMemo(() => {
    const collator = new Intl.Collator(locale);
    return Object.keys(data.articles)
      .flatMap((id) => {
        const p = data.byId.get(id)?.props;
        return p ? [{ id, name: locale === "ru" ? (p.name_ru ?? p.name) : p.name }] : [];
      })
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [data, locale]);
  if (places.length === 0) return null;
  return (
    <Section
      id="articles"
      title={`${t("articles.title")} · ${String(places.length)}`}
      defaultOpen={false}
      className="w-[340px] max-md:w-full pb-3"
    >
      <ul className="hg-fade grid max-h-[min(460px,52vh)] grid-cols-2 overflow-y-auto px-2 [scrollbar-width:thin] max-md:max-h-[calc(100dvh-var(--hg-timeline-h,124px)-200px)]">
        {places.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => {
                onPick(p.id);
              }}
              className="w-full rounded-xl px-2 py-1 text-left font-serif text-[14.5px] leading-tight text-ink hover:bg-paper-2"
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
