import type { LonLat } from "@hg/core";
import type { Locale } from "@hg/model";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LoadedData } from "../data";
import { distanceKm, roundKm } from "../distance";
import { useTranslation } from "../i18n";
import type { QuizItem } from "../print";
import { X } from "./icons";
import { Panel } from "./Panel";

/** A seeded shuffle: the same round for the same seed, another for "again". */
function shuffled<T>(list: readonly T[], seed: number): T[] {
  const out = [...list];
  let x = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * The tour's quiz on screen: where did it happen? Questions come in another order than the
 * stops, so the numbers on the route give nothing away. A choice shows the right place on the
 * map, and how far off a wrong one was; at the end, the score.
 */
export function QuizPanel({
  quiz,
  data,
  locale,
  renderer,
  onClose,
}: {
  quiz: { readonly title: string; readonly items: readonly QuizItem[] };
  data: LoadedData;
  locale: Locale;
  renderer: {
    readonly flyTo: (target: { center: LonLat; zoom?: number }) => void;
    readonly setHiddenNames?: (ids: readonly string[]) => void;
  };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [round, setRound] = useState(1);
  const items = useMemo(() => shuffled(quiz.items, round * 7919), [quiz, round]);
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const item = items[step];
  // The answers' names are off the map until given: the route's labels would tell them.
  const [given, setGiven] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const ids = new Set(quiz.items.flatMap((it) => it.ids).filter((id) => id && !given.has(id)));
    renderer.setHiddenNames?.([...ids]);
  }, [quiz, given, renderer]);
  useEffect(
    () => () => {
      renderer.setHiddenNames?.([]);
    },
    [renderer],
  );
  // The next question takes the focus from the button that brought it, which is gone.
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (step > 0) first.current?.focus();
  }, [step]);
  const at = (id: string): LonLat | undefined => data.byId.get(id)?.info.at;
  const right = item ? at(item.ids[item.answer] ?? "") : undefined;
  // The answer shown on the map once chosen.
  useEffect(() => {
    if (chosen !== null && right) renderer.flyTo({ center: right, zoom: 8 });
  }, [chosen, right, renderer]);
  const done = step >= items.length;
  const off =
    item && chosen !== null && chosen !== item.answer && right
      ? (() => {
          const there = at(item.ids[chosen] ?? "");
          return there ? roundKm(distanceKm(there, right)) : null;
        })()
      : null;
  const km = (n: number) => new Intl.NumberFormat(locale).format(n);
  const next = () => {
    setChosen(null);
    setStep(step + 1);
  };
  return (
    <Panel className="w-[min(420px,calc(100vw-376px-32px))] max-md:w-full px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-[17px] font-semibold text-ink">{t("quiz.title")}</h2>
          <p className="text-[12px] text-ink-soft">{quiz.title}</p>
        </div>
        <button
          onClick={onClose}
          aria-label={t("close")}
          className="-mt-0.5 rounded-full p-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      {done ? (
        <div className="mt-3" aria-live="polite">
          <p className="font-serif text-[20px] text-ink">
            {t("quiz.score", { score, total: items.length })}
          </p>
          <button
            onClick={() => {
              setRound(round + 1);
              setGiven(new Set());
              setStep(0);
              setScore(0);
              setChosen(null);
            }}
            className="mt-3 rounded-full bg-accent px-3.5 py-1 text-sm text-paper hover:brightness-110"
          >
            {t("quiz.again")}
          </button>
        </div>
      ) : item ? (
        <div className="mt-2">
          <p className="text-[11.5px] text-ink-soft">
            {t("quiz.step", { n: step + 1, total: items.length })} · {item.ref}
          </p>
          <p className="mt-1 font-serif text-[15.5px] leading-snug text-ink">{item.text}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label={t("quiz.where")}>
            {item.options.map((o, k) => {
              // Colours apart from the resting look, so that none overrides another.
              const look =
                chosen === null
                  ? "border-line bg-white/60 text-ink hover:border-accent"
                  : k === item.answer
                    ? "border-[#2f6b3a] bg-[#2f6b3a]/15 font-medium text-[#2f6b3a]"
                    : k === chosen
                      ? "border-[#8e2a22] bg-[#8e2a22]/10 text-[#8e2a22]"
                      : "border-line bg-white/60 text-ink opacity-50";
              return (
                <button
                  key={o}
                  ref={k === 0 ? first : undefined}
                  disabled={chosen !== null}
                  onClick={() => {
                    setChosen(k);
                    if (k === item.answer) setScore(score + 1);
                    setGiven(new Set([...given, item.ids[item.answer] ?? ""]));
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-[13.5px] ${look}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {chosen !== null && (
            <div className="mt-2 flex items-center justify-between gap-2" aria-live="polite">
              <p className="text-[13px] text-ink">
                {chosen === item.answer
                  ? t("quiz.right")
                  : off !== null
                    ? t("quiz.wrong_km", { name: item.options[item.answer] ?? "", km: km(off) })
                    : t("quiz.wrong", { name: item.options[item.answer] ?? "" })}
              </p>
              <button
                onClick={next}
                autoFocus
                className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-sm text-paper hover:brightness-110"
              >
                {step + 1 < items.length ? t("quiz.next") : t("quiz.finish")}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
