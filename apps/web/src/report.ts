import { placeName } from "@hg/model";
import type { PlaceProps } from "./data";
import { REPORT_EMAIL, REPOSITORY, SITE_ORIGIN } from "./site";

/** The place as a report names it: in the reader's language, with the English name beside. */
function reportName(place: PlaceProps, locale: string): string {
  const own = placeName(place, locale);
  const name = own === place.name ? own : `${own} / ${place.name}`;
  return `${name} (${place.id})`;
}

/** A report as an email to the project's address, the place and its map link filled in. */
export function reportMail(place: PlaceProps, locale: string): string {
  const name = reportName(place, locale);
  const subject = `Error: ${name}`;
  const body = `${name}\n${SITE_ORIGIN}/?place=${place.id}\n\n`;
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * The "Report an error" issue form (.github/ISSUE_TEMPLATE/report-an-error.yml) with this
 * place filled in: blank issues are disabled, so a plain issues/new?body= would send a reader
 * without write access to the template chooser and lose the place. Form fields are prefilled
 * by their `id`; the form offers the email address to readers without GitHub.
 */
export function reportUrl(place: PlaceProps, locale: string): string {
  const name = reportName(place, locale);
  const q = new URLSearchParams({
    template: "report-an-error.yml",
    title: `Error: ${name}`,
    page: name,
  });
  return `${REPOSITORY}/issues/new?${q.toString()}`;
}
