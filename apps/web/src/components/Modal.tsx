import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import { X } from "./icons";

/**
 * A modal window on the native <dialog>: the browser keeps focus inside, closes it on
 * Esc and makes the page behind inert. A click on the backdrop closes it too.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      // Only what the reader does closes it (Esc, the cross, the backdrop): a programmatic
      // close, when the map key replaces the settings, must not close the settings too.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="hg-modal m-auto w-[min(420px,calc(100vw-24px))] rounded-3xl border border-line bg-paper p-0 text-ink shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="font-serif text-[20px] font-semibold">{title}</h2>
        <button
          onClick={onClose}
          aria-label={t("close")}
          title={t("close")}
          className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </dialog>
  );
}
