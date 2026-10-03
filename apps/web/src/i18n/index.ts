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

type Dict = { readonly [key: string]: string | Dict };
type Vars = Readonly<Record<string, string | number>>;
export type TFunction = (key: string, vars?: Vars) => string;

// English ships with the page: it is the fallback for any missing key. Every other
// language is its own small file, fetched when first asked for, so a language added is
// not a cost for the readers of the others.
const LAZY = import.meta.glob<{ default: Dict }>(["./*.json", "!./en.json"]);
const DICTS: Record<string, Dict> = { en };

let language = "en";
/** The language asked for last: a slower dictionary that arrives later does not win. */
let wanted = "en";
const listeners = new Set<() => void>();

/** Fetches a language's dictionary once; false for a language without one. */
export async function loadLanguage(lng: string): Promise<boolean> {
  if (lng in DICTS) return true;
  const load = LAZY[`./${lng}.json`];
  if (!load) return false;
  DICTS[lng] = (await load()).default;
  return true;
}

export const i18n = {
  get language(): string {
    return language;
  },
  /**
   * Switches the UI language once its dictionary is in; unknown languages are ignored,
   * and a dictionary that fails to load leaves the language as it was.
   */
  async changeLanguage(lng: string): Promise<void> {
    wanted = lng;
    const ok = await loadLanguage(lng).catch(() => false);
    if (!ok || lng !== wanted || lng === language) return;
    language = lng;
    for (const l of listeners) l();
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
