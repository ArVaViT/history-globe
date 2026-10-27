/**
 * Reviews by scholars on the static pages: the line under an article's or a question's
 * title, the structured data of a reviewed page, the list of reviews (/<lang>/reviews/) and
 * a page for each (/<lang>/reviews/<id>/). build-pages.ts writes them; with no reviews
 * `reviewPages` gives nothing, so no empty page is built and nothing links to one.
 *
 * Our words come from review-words.ts; the reviewer's are shown as written, in their
 * language (marked with `lang`), and a translation of them only beside the original.
 */
import {
  type ItemReview,
  type ReviewKind,
  type ReviewRecord,
  translationsRead,
} from "../packages/model/src/reviews.ts";
import type { SiteLocale } from "../packages/model/src/time.ts";
import { esc } from "./page-shell.ts";
import { REVIEW_WORDS } from "./review-words.ts";

const REPO = "https://github.com/ArVaViT/history-globe";
/** Where a citation points when the build has no SITE_URL. */
const HOME = "https://historyglobe.app";

/** A date of our own time (YYYY-MM-DD) in the page's language: "14 November 2026". */
export function reviewDate(iso: string, l: SiteLocale): string {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  // English as the documentation writes it: "14 November 2026" (build-docs.ts).
  return new Intl.DateTimeFormat(l === "en" ? "en-GB" : l, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(Date.UTC(y, m - 1, d));
}

/**
 * The line under the title of an article or an answered question: who reviewed it, or that
 * it has been checked against its sources and how. `up` leads from the page to the site's
 * root; `methodology` is the methodology page's path from there.
 */
export function statusLine(o: {
  l: SiteLocale;
  reviews: readonly ItemReview[] | undefined;
  checked: string;
  up: string;
  methodology: string;
}): string {
  const W = REVIEW_WORDS[o.l];
  if (!o.reviews?.length)
    return `<p class="status">${esc(o.checked)} · <a href="${o.up}${o.methodology}">${esc(W.howWeCheck)}&nbsp;→</a></p>`;
  const lines = o.reviews.map(
    (r) =>
      `<p class="status reviewed">${esc(W.reviewedBy(r.name, r.institution))} · ${esc(reviewDate(r.date, o.l))}${r.changed ? ` · ${esc(W.changedSince)}` : ""}${r.status === "corrections-in-progress" ? ` · ${esc(W.corrections)}` : ""} · <a href="${o.up}${o.l}/reviews/${r.id}/">${esc(W.readReview)}&nbsp;→</a></p>`,
  );
  // The reviewers read the English unless they say which translations they read too.
  if (o.l !== "en" && !o.reviews.some((r) => r.translations.includes(o.l)))
    lines.push(`<p class="note status-note">${esc(W.englishOnly)}</p>`);
  return lines.join("\n      ");
}

/** The reviewer as schema.org has a person: name, post, institution, ORCID and page. */
function person(r: ReviewRecord) {
  const same = [
    ...(r.reviewer.orcid ? [`https://orcid.org/${r.reviewer.orcid}`] : []),
    ...(r.reviewer.url ? [r.reviewer.url] : []),
  ];
  return {
    "@type": "Person",
    name: r.reviewer.name,
    jobTitle: r.reviewer.title,
    affiliation: { "@type": "Organization", name: r.reviewer.institution },
    ...(same.length ? { sameAs: same } : {}),
  };
}

/**
 * The `review` of a reviewed page's structured data: who reviewed it and when, linked to
 * the review's page. No rating: a review here is a reading, not a score.
 */
export function itemReviewLd(
  reviews: readonly ItemReview[] | undefined,
  records: ReadonlyMap<string, ReviewRecord>,
  site: string,
  l: SiteLocale,
): { review?: object[] } {
  const list = (reviews ?? []).flatMap((r) => {
    const rec = records.get(r.id);
    return rec
      ? [
          {
            "@type": "Review",
            author: person(rec),
            datePublished: rec.date,
            url: `${site}/${l}/reviews/${rec.id}/`,
          },
        ]
      : [];
  });
  return list.length ? { review: list } : {};
}

/** An item a review covers, as its page names and links it (from the site's root). */
export type ItemLink = (
  kind: ReviewKind,
  id: string,
  l: SiteLocale,
) => { name: string; path: string };

/** How many items of each kind the site has, for "12 of 746 articles". */
export type Totals = Readonly<Record<ReviewKind, number>>;

export interface ReviewPage {
  /** From the site root, without the trailing slash: "en/reviews", "en/reviews/<id>". */
  readonly path: string;
  readonly title: string;
  readonly desc: string;
  readonly body: string;
  readonly ld?: object;
}

const KINDS: readonly ReviewKind[] = ["article", "question", "tour"];

/** The reviewer's words, in their language: marked so, and never translated in place. */
const theirs = (text: string, lang: string, l: SiteLocale) =>
  lang === l ? esc(text) : `<span lang="${esc(lang)}">${esc(text)}</span>`;

/**
 * In the form of the methodology's "How to cite" (a page of the site), with the date the
 * review was published: "Doe, Jane. “Review of History Globe: ….” In Vadym Arnaut, History
 * Globe. <url> (published 14 November 2026)." and the DOI when there is one.
 */
export function citation(r: ReviewRecord, site: string): string {
  const url = `${site || HOME}/en/reviews/${r.id}/`;
  return `${r.reviewer.family}, ${r.reviewer.given}. “Review of History Globe: ${r.title.en}.” In Vadym Arnaut, History Globe. ${url} (published ${reviewDate(r.date, "en")}).${r.doi ? ` https://doi.org/${r.doi}.` : ""}`;
}

/**
 * The list of reviews and a page for each, in one language: nothing when there are none.
 * The list is two levels below the site's root, a review three.
 */
export function reviewPages(o: {
  l: SiteLocale;
  reviews: readonly ReviewRecord[];
  item: ItemLink;
  totals: Totals;
  site: string;
  /** The review policy's path from the site root (docs/reviews.html, docs/<l>/reviews.html). */
  policy: string;
}): ReviewPage[] {
  if (o.reviews.length === 0) return [];
  const { l } = o;
  const W = REVIEW_WORDS[l];
  const n = new Intl.NumberFormat(l);
  const title = (r: ReviewRecord) => r.title[l] ?? r.title.en;
  const scope = (r: ReviewRecord) =>
    `<p class="note"><b>${esc(W.reviewedFor)}:</b> ${r.scope.checked.map((s) => esc(W.scopes[s])).join(" · ")}${
      r.scope.not_checked.length
        ? `<br /><b>${esc(W.notReviewed)}:</b> ${r.scope.not_checked.map((s) => esc(W.scopes[s])).join(" · ")}`
        : ""
    }</p>`;
  const who = (r: ReviewRecord) => {
    const links = [
      ...(r.reviewer.orcid
        ? [
            `<a href="https://orcid.org/${esc(r.reviewer.orcid)}" rel="noopener">ORCID ${esc(r.reviewer.orcid)}</a>`,
          ]
        : []),
      ...(r.reviewer.url
        ? [`<a href="${esc(r.reviewer.url)}" rel="noopener">${esc(W.page)}</a>`]
        : []),
    ];
    return `<div class="reviewer"><p class="reviewer-name">${esc(r.reviewer.name)}${r.reviewer.name_native ? ` <span class="note">(${esc(r.reviewer.name_native)})</span>` : ""}</p>
        <p class="note">${esc(r.reviewer.title)}, ${esc(r.reviewer.institution)} <span>(${esc(W.affiliation)})</span>${links.length ? `<br />${links.join(" · ")}` : ""}</p></div>`;
  };
  const statement = (r: ReviewRecord) => {
    const own = r.statement.translations?.[l];
    return `<blockquote class="statement" lang="${esc(r.statement.lang)}"><p>${esc(r.statement.text)}</p></blockquote>${
      own && r.statement.lang !== l
        ? `\n      <blockquote class="statement translated"><p>${esc(own)}</p><p class="note">${esc(W.translationNote)}</p></blockquote>`
        : ""
    }`;
  };
  const when = (r: ReviewRecord) =>
    `${esc(W.reviewedOn(reviewDate(r.date, l)))} · ${esc(W.version(reviewDate(r.version.date, l), r.version.commit.slice(0, 7)))}`;

  const pages: ReviewPage[] = [];
  const policyLink = (up: string) => `<a href="${up}${o.policy}">${esc(W.policy)}&nbsp;→</a>`;

  // The list: who read what, newest first; how much of the site has been read so far.
  const covered = (k: ReviewKind) =>
    new Set(o.reviews.flatMap((r) => r.covers.filter((c) => c.kind === k).map((c) => c.id))).size;
  const so = W.soFar(
    W.of(n.format(covered("article")), n.format(o.totals.article)),
    W.of(n.format(covered("question")), n.format(o.totals.question)),
    W.of(n.format(covered("tour")), n.format(o.totals.tour)),
  );
  pages.push({
    path: `${l}/reviews`,
    title: W.title,
    desc: W.lead,
    body: `    <main id="main" class="page reviews">
      <h1>${esc(W.title)}</h1>
      <p class="list-lead">${esc(W.lead)} ${policyLink("../../")}</p>
      <p class="note">${esc(so)}</p>
      ${o.reviews
        .map((r) => {
          const counts = KINDS.map((k) => [k, r.covers.filter((c) => c.kind === k)] as const)
            .filter(([, list]) => list.length > 0)
            .map(
              ([k, list]) =>
                `${esc(W.kinds[k])}: ${list
                  .map((c) => {
                    const it = o.item(c.kind, c.id, l);
                    return `<a href="../../${it.path}">${esc(it.name)}</a>`;
                  })
                  .join(" · ")}`,
            );
          return `<section class="review-card">
        ${who(r)}
        <h2><a href="${r.id}/">${esc(title(r))}</a></h2>
        <p class="note">${when(r)}</p>
        <p class="note">${counts.join("<br />")}</p>
        ${scope(r)}
        ${statement(r)}
        ${r.status === "corrections-in-progress" ? `<p class="note">${esc(W.inProgress)}</p>` : ""}
        <p><a href="${r.id}/">${esc(W.readReview)}&nbsp;→</a></p>
      </section>`;
        })
        .join("\n      ")}
    </main>`,
  });

  for (const r of o.reviews) {
    const up = "../../../";
    const items = KINDS.map((k) => [k, r.covers.filter((c) => c.kind === k)] as const)
      .filter(([, list]) => list.length > 0)
      .map(
        ([k, list]) =>
          `<h3>${esc(W.kinds[k])}</h3>
      <ul class="cards">${list
        .map((c) => {
          const it = o.item(c.kind, c.id, l);
          return `<li><a href="${up}${it.path}">${esc(it.name)}${c.changed ? ` <span class="note">(${esc(W.changedItem)})</span>` : ""}</a></li>`;
        })
        .join("")}</ul>`,
      )
      .join("\n      ");
    const response = r.response?.length
      ? `<h2>${esc(W.response)}</h2>
      <div class="table"><table class="response"><thead><tr><th>${esc(W.colPoint)}</th><th>${esc(W.colAction)}</th><th>${esc(W.colCommit)}</th></tr></thead><tbody>${r.response
        .map(
          (p) =>
            `<tr><td>${theirs(p.point, r.statement.lang, l)}</td><td><b>${esc(W.actions[p.action])}.</b> ${esc(p.detail[l] ?? p.detail.en)}</td><td>${p.commit ? `<a href="${REPO}/commit/${p.commit}"><code>${p.commit.slice(0, 7)}</code></a>` : ""}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div>${r.response_confirmed ? `\n      <p class="note">${esc(W.confirmed)}</p>` : ""}`
      : "";
    const full = r.full_review
      ? `<h2>${esc(W.fullReview)}</h2>
      <div class="full-review" lang="${esc(r.full_review.lang)}">${r.full_review.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`
      : "";
    const licence =
      r.licence === "CC-BY-4.0"
        ? esc(W.licenceCc(r.reviewer.name)).replace(
            "CC BY 4.0",
            '<a rel="license" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
          )
        : esc(W.statementOnly);
    pages.push({
      path: `${l}/reviews/${r.id}`,
      title: W.reviewOf(title(r)),
      desc: `${W.reviewedBy(r.reviewer.name, r.reviewer.institution)} · ${reviewDate(r.date, l)}`,
      body: `    <main id="main" class="page review">
      <p class="kicker"><a href="../">${esc(W.title)}</a></p>
      <h1>${esc(title(r))}</h1>
      ${who(r)}
      <p class="note">${when(r)}</p>${r.status === "corrections-in-progress" ? `\n      <div class="callout"><p>${esc(W.inProgress)}</p></div>` : ""}
      ${scope(r)}${r.scope.note ? `\n      <p class="note"><b>${esc(W.note)}:</b> ${theirs(r.scope.note, r.statement.lang, l)}</p>` : ""}
      ${items}
      <h2>${esc(W.statement)}</h2>
      ${statement(r)}${l !== "en" && !translationsRead(r).includes(l) ? `\n      <p class="note">${esc(W.englishOnly)}</p>` : ""}
      <p class="note"><b>${esc(W.conflicts)}:</b> ${theirs(r.conflicts, r.statement.lang, l)}</p>
      ${full}
      <p class="note">${licence}${r.doi ? ` · DOI <a href="https://doi.org/${esc(r.doi)}">${esc(r.doi)}</a>` : ""}</p>
      ${response}
      <p class="note"><a href="${REPO}/tree/${r.version.commit}/content">${esc(W.versionRead)} (${r.version.commit.slice(0, 7)})</a> · <a href="${REPO}/compare/${r.version.commit}...main">${esc(W.versionNow)}</a></p>
      <h2>${esc(W.cite)}</h2>
      <p class="cite" lang="en">${esc(citation(r, o.site))}</p>
      <p class="note">${esc(W.consent(reviewDate(r.consent.date, l)))} ${policyLink(up)}</p>
      <p class="note"><a href="../">${esc(W.all)}&nbsp;→</a></p>
    </main>`,
      ld: {
        "@context": "https://schema.org",
        "@type": "Review",
        name: W.reviewOf(title(r)),
        author: person(r),
        datePublished: r.date,
        reviewBody: r.statement.text,
        inLanguage: r.statement.lang,
        url: `${o.site}/${l}/reviews/${r.id}/`,
        publisher: { "@type": "Organization", name: "History Globe", url: `${o.site}/` },
        ...(r.licence === "CC-BY-4.0"
          ? { license: "https://creativecommons.org/licenses/by/4.0/" }
          : {}),
        ...(r.doi ? { sameAs: `https://doi.org/${r.doi}` } : {}),
        itemReviewed: r.covers.map((c) => {
          const it = o.item(c.kind, c.id, l);
          return { "@type": "CreativeWork", name: it.name, url: `${o.site}/${it.path}` };
        }),
      },
    });
  }
  return pages;
}
