// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { type AncientMention, type Locale, pick } from "@hg/model";
import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { cachedJson } from "../../data";

type Mentions = Readonly<Record<string, readonly AncientMention[]>>;
const loadAncient = () => cachedJson<Mentions>("ancient-authors.json").catch((): Mentions => ({}));

/**
 * The place in ancient writers outside the Bible, in the manner of ToposText: who, where in
 * the work, a free text of the passage, and what it says in our words.
 */
export function AncientAuthors({ placeId, locale }: { placeId: string; locale: Locale }) {
  const { t } = useTranslation();
  const [mentions, setMentions] = useState<readonly AncientMention[]>([]);
  useEffect(() => {
    let live = true;
    void loadAncient().then((all) => {
      if (live) setMentions(all[placeId] ?? []);
    });
    return () => {
      live = false;
    };
  }, [placeId]);
  if (mentions.length === 0) return null;
  return (
    <div className="px-5 pt-3 text-[13px] leading-snug">
      <h3 className="text-[12px] text-ink-soft">{t("place.ancient_authors")}</h3>
      <ul className="mt-1 flex flex-col gap-1.5">
        {mentions.map((m) => (
          <li key={`${m.author.en} ${m.work.en} ${m.passage}`}>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="link-accent">
              {pick(m.author, locale) ?? ""}, <i>{pick(m.work, locale) ?? ""}</i>{" "}
              {m.passage.replace(/-/g, "–")}
              <span className="sr-only"> ({t("new_tab")})</span>
            </a>
            <span className="text-ink"> — {pick(m.note, locale) ?? ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
