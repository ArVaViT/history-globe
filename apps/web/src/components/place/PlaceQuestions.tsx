// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { type Locale, pick } from "@hg/model";
import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { loadQuestions, type PlaceQuestion } from "../../articles";

/** The questions answered with the place on the map; each links to its page, /{locale}/q/{id}/. */
export function PlaceQuestions({ placeId, locale }: { placeId: string; locale: Locale }) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<readonly PlaceQuestion[]>([]);
  useEffect(() => {
    let live = true;
    void loadQuestions(placeId, locale).then((got) => {
      if (live) setQuestions(got);
    });
    return () => {
      live = false;
    };
  }, [placeId, locale]);
  if (questions.length === 0) return null;
  return (
    <div className="px-5 pt-3 text-[13px] leading-snug">
      <h3 className="text-[12px] text-ink-soft">{t("place.questions")}</h3>
      <ul className="mt-0.5">
        {questions.map((q) => (
          <li key={q.id}>
            <a
              href={`${import.meta.env.BASE_URL}${locale}/q/${q.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent"
            >
              {pick(q, locale) ?? ""}
              <span className="sr-only"> ({t("new_tab")})</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
