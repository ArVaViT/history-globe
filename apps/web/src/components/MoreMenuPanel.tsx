import { useTranslation } from "../i18n";
import { Camera, Maximize, Printer, Route } from "./icons";

const SPEEDS = [0.5, 1, 2, 4];
const speedLabel = (speed: number) => (speed < 1 ? "½×" : `${String(speed)}×`);

/**
 * The player's menu, opened from its "…" button (Timeline's MoreMenu): the speed, the
 * panel's transparency, full screen, the picture and the sheets for a class. In its own
 * chunk: nothing of it is drawn before the first press.
 */
export function MoreMenuPanel({
  speed,
  onSpeed,
  alpha,
  onAlpha,
  onPicture,
  onPrint,
  onPrintBlank,
  onPrintQuiz,
  onQuiz,
  close,
}: {
  speed: number;
  onSpeed: (speed: number) => void;
  alpha: number;
  onAlpha: (alpha: number) => void;
  onPicture?: (() => void) | undefined;
  onPrint?: (() => void) | undefined;
  onPrintBlank?: (() => void) | undefined;
  /** A quiz for pupils on the tour: where each thing happened (print.ts printQuiz). */
  onPrintQuiz?: (() => void) | undefined;
  /** The same quiz played on screen (QuizPanel). */
  onQuiz?: (() => void) | undefined;
  close: () => void;
}) {
  const { t } = useTranslation();
  const item =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-ink hover:bg-paper-2";
  return (
    <div
      id="player-more"
      className="hg-pop absolute right-0 bottom-full z-20 mb-2 w-64 origin-bottom-right rounded-2xl border border-line bg-paper p-1.5 shadow-xl"
    >
      {/* Two rows of the same shape: a label, then its control. */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="w-[92px] shrink-0 text-[12.5px] text-ink-soft">{t("time.speed")}</span>
        <div
          role="group"
          aria-label={t("time.speed")}
          className="flex flex-1 gap-0.5 rounded-full bg-paper-2 p-0.5"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                onSpeed(s);
              }}
              aria-pressed={speed === s}
              className={`flex-1 rounded-full py-0.5 text-[12px] font-semibold tabular-nums ${speed === s ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {speedLabel(s)}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="shrink-0 text-[12.5px] whitespace-nowrap text-ink-soft">
          {t("time.opacity")}
        </span>
        <input
          type="range"
          // Further right, more of the map shows through: the transparency itself.
          min={0}
          max={0.7}
          step={0.05}
          value={Math.round((1 - alpha) * 100) / 100}
          onChange={(e) => {
            onAlpha(1 - Number(e.target.value));
          }}
          aria-valuetext={`${String(Math.round((1 - alpha) * 100))}%`}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
        />
      </label>
      <div className="my-1 border-t border-line" />
      {document.fullscreenEnabled && (
        <button
          className={item}
          onClick={() => {
            close();
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
          }}
        >
          <Maximize className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t("time.fullscreen")}
        </button>
      )}
      {onPicture && (
        <button
          className={item}
          onClick={() => {
            close();
            onPicture();
          }}
        >
          <Camera className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t("time.picture")}
        </button>
      )}
      {onPrint && (
        <button
          className={item}
          onClick={() => {
            close();
            onPrint();
          }}
        >
          <Printer className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t("time.print")}
        </button>
      )}
      {onPrintBlank && (
        <button
          className={item}
          onClick={() => {
            close();
            onPrintBlank();
          }}
        >
          <Printer className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t("time.print_blank")}
        </button>
      )}
      {onPrintQuiz && (
        <button
          className={item}
          onClick={() => {
            close();
            onPrintQuiz();
          }}
        >
          <Printer className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t("time.print_quiz")}
        </button>
      )}
      {onQuiz && (
        <button
          className={item}
          onClick={() => {
            close();
            onQuiz();
          }}
        >
          <Route className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t("time.quiz")}
        </button>
      )}
    </div>
  );
}
