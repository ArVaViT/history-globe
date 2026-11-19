import { formatRef, sourcesOf, type Locale, pick, docsPath, splitPlaces } from "@hg/model";
import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { loadArticle, type Article } from "../../articles";
import { verseUrl } from "../../links";
import { loadTextPlaces } from "../../text-places";

/**
 * The place's article, whole (its tab is for reading), then the verses and the sources
 * behind it and how far it has been checked.
 */
export function ArticleSection({
  placeId,
  locale,
  onHighlight,
}: {
  placeId: string;
  locale: Locale;
  onHighlight?: ((placeId: string | null) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  // The other places the text names, found as in the verses; plain text until the index is in.
  const [index, setIndex] = useState<Awaited<ReturnType<typeof loadTextPlaces>> | null>(null);
  useEffect(() => {
    if (!onHighlight) return;
    let live = true;
    loadTextPlaces(locale).then(
      (i) => {
        if (live) setIndex(i);
      },
      () => undefined,
    );
    return () => {
      live = false;
      onHighlight(null);
    };
  }, [locale, onHighlight]);
  useEffect(() => {
    let live = true;
    // A failed load leaves the card without the article; the next card tries again.
    loadArticle(placeId, locale).then(
      (a) => {
        if (live) setArticle(a ?? null);
      },
      () => {
        if (live) setArticle(null);
      },
    );
    return () => {
      live = false;
    };
  }, [placeId, locale]);
  // The tab is open while the article loads, or if it failed: say so rather than show nothing.
  if (article === undefined) return <p className="px-5 pt-3 text-[13px] text-ink-soft">…</p>;
  if (article === null)
    return <p className="px-5 pt-3 text-[13px] text-ink-soft">{t("place.article_failed")}</p>;
  const body = pick(article.body, locale) ?? [];
  return (
    <section className="px-5 pt-3">
      <ReviewLine article={article} locale={locale} />
      <div className="mt-3 space-y-3 font-serif text-[16px] leading-[1.65] text-ink">
        {body.map((p) => (
          <p key={p.slice(0, 24)}>
            {index && onHighlight
              ? // A name only marks its place on the map: the reader stays in the text.
                splitPlaces(p, index, [placeId]).map((seg, i) =>
                  seg.place ? (
                    <span
                      key={i}
                      tabIndex={0}
                      onMouseEnter={() => {
                        onHighlight(seg.place ?? null);
                      }}
                      onMouseLeave={() => {
                        onHighlight(null);
                      }}
                      onFocus={() => {
                        onHighlight(seg.place ?? null);
                      }}
                      onBlur={() => {
                        onHighlight(null);
                      }}
                      className="underline decoration-accent/35 decoration-dotted underline-offset-4 hover:decoration-accent focus-visible:decoration-accent focus-visible:outline-none"
                    >
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )
              : p}
          </p>
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-2 text-[12px] leading-snug text-ink-soft">
        <div>
          {t("place.article_scripture")}:{" "}
          {article.scripture.map((o, i) => (
            <span key={o}>
              {i > 0 && ", "}
              <a
                href={verseUrl(o, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="link-soft"
              >
                {formatRef(o, locale)}
              </a>
            </span>
          ))}
        </div>
        <div className="mt-1">
          {t("place.article_sources")}: {sourcesOf(article, locale).join("; ")}.
        </div>
        {/* The article is the site's own text, under its own licence (ADR 0016). */}
        <div className="mt-1">
          {t("place.article_licence")},{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-nd/4.0/"
            target="_blank"
            rel="license noopener noreferrer"
            className="link-soft"
          >
            CC BY-NC-ND 4.0
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * How far the article has been read, at its head and in the text's own weight: the
 * scholars who reviewed it (content/reviews), each with a link to the review, or that it
 * has been checked against its sources, with a link to how.
 */
function ReviewLine({ article, locale }: { article: Article; locale: Locale }) {
  const { t } = useTranslation();
  const base = import.meta.env.BASE_URL;
  const reviews = article.reviews ?? [];
  if (reviews.length === 0)
    return (
      <p className="text-[13.5px] leading-snug text-ink-soft">
        {t("place.article_checked")} ·{" "}
        <a
          href={`${base}${docsPath(locale, "methodology")}#review`}
          target="_blank"
          rel="noopener"
          className="link-accent"
        >
          {t("place.article_how")}&nbsp;→
        </a>
      </p>
    );
  // A date of our own time, as the reader's language writes it ("14 November 2026", as the
  // static pages and the documentation write it).
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  return (
    <div className="border-l-2 border-accent/60 pl-2.5 text-[13.5px] leading-snug text-ink">
      {reviews.map((r) => (
        <p key={r.id}>
          {t("place.article_reviewed", { name: r.name, institution: r.institution })} ·{" "}
          {day(r.date)}
          {r.changed ? ` · ${t("place.article_changed")}` : ""}
          {r.status === "corrections-in-progress"
            ? ` · ${t("place.article_corrections")}`
            : ""} ·{" "}
          <a
            href={`${base}${locale}/reviews/${r.id}/`}
            target="_blank"
            rel="noopener"
            className="link-accent"
          >
            {t("place.article_review_read")}&nbsp;→
          </a>
        </p>
      ))}
      {locale !== "en" && !reviews.some((r) => r.translations.includes(locale)) && (
        <p className="mt-0.5 text-[12px] text-ink-soft">{t("place.article_english_only")}</p>
      )}
    </div>
  );
}
