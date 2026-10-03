import { formatCentury, medianYear, type ChapterYears, type Locale } from "@hg/model";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { loadPeople, peopleNow, personName, type People } from "../people";
import { Section } from "./Panel";

/**
 * Listed: people the text names often and who are central at places on the map. Places
 * alone brought in the kings of Genesis 14 beside Abraham: their one campaign crosses
 * five of them.
 */
const MIN_VERSES = 25;
const MIN_PLACES = 2;

/**
 * The people of the story, by century: those central to several places on the map, the
 * oldest first. A pick opens their card, which takes the map to their time.
 */
export function PeoplePanel({
  chapterYears,
  placeName,
  placeRank,
  onPerson,
}: {
  chapterYears: ChapterYears;
  placeName: (id: string) => string | undefined;
  placeRank: (id: string) => number;
  onPerson: (index: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "ru" ? "ru" : "en";
  const [people, setPeople] = useState<People | null>(peopleNow);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!people)
      void loadPeople().then(setPeople, () => {
        setFailed(true);
      });
  }, [people]);

  const groups = useMemo(() => {
    if (!people) return [];
    const rows = people.people.flatMap((p) => {
      const tied = (people.placesOf.get(p.index) ?? []).filter((x) => placeName(x.place));
      if (p.verses < MIN_VERSES || tied.filter((x) => x.tier <= 1).length < MIN_PLACES) return [];
      // A title, not a name ("фараон", "царь"): lower-case in the Synodal form, whatever
      // the language shown, so both lists hold the same people.
      const synodal = p.ru ?? p.name;
      if (synodal.charAt(0) !== synodal.charAt(0).toLocaleUpperCase("ru")) return [];
      const name = personName(p, locale);
      const year = medianYear(
        tied.map((x) => x.verse),
        chapterYears,
      );
      if (year === undefined) return [];
      // The place most tied to them, shown only to tell namesakes apart (two Johns).
      const top = [...tied].sort(
        (a, b) => a.tier - b.tier || placeRank(a.place) - placeRank(b.place),
      )[0];
      return [{ person: p, year, name, where: top ? placeName(top.place) : undefined }];
    });
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.name, (seen.get(r.name) ?? 0) + 1);
    rows.sort((a, b) => a.year - b.year || a.person.name.localeCompare(b.person.name));
    const out: { century: string; rows: typeof rows }[] = [];
    for (const row of rows) {
      const century = formatCentury(row.year, locale);
      const last = out.at(-1);
      if (last?.century === century) last.rows.push(row);
      else out.push({ century, rows: [row] });
    }
    return out.map((g) => ({
      ...g,
      rows: g.rows.map((r) => ({ ...r, twin: (seen.get(r.name) ?? 0) > 1 })),
    }));
  }, [people, chapterYears, placeName, placeRank, locale]);

  return (
    <Section id="people" title={t("overview.people")} className="w-[340px] max-md:w-full pb-3">
      <div className="hg-fade max-h-[min(460px,52vh)] scroll-pt-7 overflow-y-auto [scrollbar-width:thin] max-md:max-h-[calc(100dvh-var(--hg-timeline-h,124px)-200px)]">
        {/* "Loading the map" was the only loading word: the list is quick, it shows nothing
            until it is in, and says so if it cannot load. */}
        {failed && <div className="px-4 py-2 text-sm text-ink-soft">{t("search.empty")}</div>}
        {groups.map(({ century, rows }) => (
          <section key={century} aria-label={century}>
            <div className="sticky top-0 z-[1] bg-paper px-4 pt-2 pb-0.5 text-[11.5px] font-medium text-ink-soft">
              {century}
            </div>
            {rows.map(({ person, name, where, twin }) => (
              <button
                key={person.id}
                onClick={() => {
                  onPerson(person.index);
                }}
                className="mx-2 flex w-[calc(100%-16px)] items-baseline justify-between gap-3 rounded-xl px-2 py-1 text-left hover:bg-paper-2"
              >
                <span className="font-serif text-[14.5px] text-ink">{name}</span>
                {twin && where && (
                  <span className="truncate text-[11.5px] text-ink-soft">{where}</span>
                )}
              </button>
            ))}
          </section>
        ))}
      </div>
    </Section>
  );
}
