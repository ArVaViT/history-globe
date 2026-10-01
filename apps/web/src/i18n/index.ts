/**
 * The UI dictionaries and a `t` for them: nested keys, {{name}} placeholders, and plural
 * forms chosen by Intl.PluralRules (ru: _one/_few/_many, en: _one/_other). A missing key
 * falls back to English, then to the key itself, which callers may test for.
 *
 * It replaces i18next and react-i18next, which cost 16 kB gzip before the first frame
 * for these three features (ADR 0010).
 */
import { useCallback, useSyncExternalStore } from "react";
import en from "./en.json";
import ru from "./ru.json";

type Dict = { readonly [key: string]: string | Dict };
type Vars = Readonly<Record<string, string | number>>;
export type TFunction = (key: string, vars?: Vars) => string;

const DICTS: Readonly<Record<string, Dict>> = { ru, en };

let language = "ru";
const listeners = new Set<() => void>();

export const i18n = {
  get language(): string {
    return language;
  },
  /** Switches the UI language; unknown languages are ignored. */
  changeLanguage(lng: string): Promise<void> {
    if (lng !== language && lng in DICTS) {
      language = lng;
      for (const l of listeners) l();
    }
    return Promise.resolve();
  },
};

const plurals = new Map<string, Intl.PluralRules>();
function pluralOf(lng: string, count: number): string {
  let rules = plurals.get(lng);
  if (!rules) {
    rules = new Intl.PluralRules(lng);
    plurals.set(lng, rules);
  }
  return rules.select(count);
}

function lookup(dict: Dict | undefined, key: string): string | undefined {
  let at: string | Dict | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof at !== "object") return undefined;
    at = at[part];
  }
  return typeof at === "string" ? at : undefined;
}

export function translate(lng: string, key: string, vars?: Vars): string {
  const count = vars?.count;
  const keys =
    typeof count === "number" ? [`${key}_${pluralOf(lng, count)}`, `${key}_other`, key] : [key];
  for (const dict of [DICTS[lng], DICTS.en]) {
    for (const k of keys) {
      const text = lookup(dict, k);
      if (text !== undefined)
        return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, name: string) =>
          vars && name in vars ? String(vars[name]) : all,
        );
    }
  }
  return key;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The current language's `t`; components re-render when the language changes. */
export function useTranslation(): { t: TFunction; i18n: typeof i18n } {
  const lng = useSyncExternalStore(subscribe, () => language);
  const t = useCallback<TFunction>((key, vars) => translate(lng, key, vars), [lng]);
  return { t, i18n };
}
