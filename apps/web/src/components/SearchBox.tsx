import { Search } from "./icons";
import { useMemo, useState, type RefObject } from "react";
import { useTranslation } from "../i18n";
import { searchPlaces, type LoadedData, type PlaceProps } from "../data";
import { Panel } from "./Panel";

/**
 * The search in the header, in the title's place: the field on the header's line and the
 * results dropping below it, over the column. Esc or a choice gives the title back.
 */
export function SearchBox({
  data,
  inputRef,
  onSelect,
  onClose,
}: {
  data: LoadedData;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (placeId: string) => void;
  /** `focusBack`: Esc or a choice hands the focus back to the magnifier; a click away does not. */
  onClose: (focusBack: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchPlaces(data, query), [data, query]);
  const ru = i18n.language === "ru";
  const open = query.trim().length >= 2;
  const nameOf = (p: PlaceProps) => (ru ? (p.name_ru ?? p.name) : p.name);

  const choose = (id: string) => {
    onSelect(id);
    setQuery("");
    onClose(true);
  };

  return (
    <div
      className="min-w-0 flex-1"
      // A click away (the map, the column) closes the search; a press inside the header
      // (its own cross) does not, and the results keep the focus with preventDefault.
      onBlur={(e) => {
        const header = e.currentTarget.parentElement;
        if (!header?.contains(e.relatedTarget)) onClose(false);
      }}
    >
      <label className="flex items-center gap-2 rounded-full bg-paper-2/70 px-3 py-1.5 focus-within:ring-2 focus-within:ring-focus">
        <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
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
              onClose(true);
            }
          }}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? "search-results" : undefined}
          aria-activedescendant={
            open && results[active] ? `search-${results[active].props.id}` : undefined
          }
          className="w-full min-w-0 bg-transparent text-[15px] text-ink outline-hidden placeholder:text-ink-soft"
        />
      </label>
      {open && (
        <Panel className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden">
          <ul
            id="search-results"
            className="max-h-80 overflow-auto py-1"
            role="listbox"
            aria-label={t("search.placeholder")}
          >
            {results.length === 0 && (
              <li className="px-4 py-2 text-sm text-ink-soft">{t("search.empty")}</li>
            )}
            {results.map(({ props }, i) => {
              const primary = nameOf(props);
              // Namesakes (three Beth-shemeshes) are told apart by where they are.
              const namesake = results.some(
                (r) => r.props.id !== props.id && nameOf(r.props) === primary,
              );
              const secondary =
                ru && props.name_ru && !namesake
                  ? props.name
                  : ru
                    ? (props.where_ru ?? props.where)
                    : props.where;
              return (
                <li
                  key={props.id}
                  id={`search-${props.id}`}
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
        </Panel>
      )}
    </div>
  );
}
