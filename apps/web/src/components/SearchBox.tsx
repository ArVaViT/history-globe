import { Search } from "lucide-react";
import { useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { searchPlaces, type LoadedData } from "../data";
import { Panel } from "./Panel";

export function SearchBox({
  data,
  inputRef,
  onSelect,
}: {
  data: LoadedData;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (placeId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchPlaces(data, query), [data, query]);
  const ru = i18n.language === "ru";

  const choose = (id: string) => {
    onSelect(id);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <Panel className="w-[340px] max-md:w-full overflow-hidden">
      <label className="flex items-center gap-2 px-4 py-3">
        <Search className="size-4 text-ink-soft" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter" && results[active]) choose(results[active].props.id);
            else if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft/70"
        />
      </label>
      {query.trim().length >= 2 && (
        <ul className="max-h-80 overflow-auto border-t border-line py-1" role="listbox">
          {results.length === 0 && (
            <li className="px-4 py-2 text-sm text-ink-soft">{t("search.empty")}</li>
          )}
          {results.map(({ props }, i) => {
            const primary = ru ? (props.name_ru ?? props.name) : props.name;
            const secondary =
              ru && props.name_ru ? props.name : ru ? (props.where_ru ?? props.where) : props.where;
            return (
              <li
                key={props.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => {
                  setActive(i);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(props.id);
                }}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-1.5 ${i === active ? "bg-paper-2" : ""}`}
              >
                <span className="font-serif text-[15px] text-ink">{primary}</span>
                <span className="truncate text-xs text-ink-soft">{secondary}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
