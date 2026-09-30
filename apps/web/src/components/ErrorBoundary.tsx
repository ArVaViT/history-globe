import { Component, type ReactNode } from "react";
import { translate, i18n } from "../i18n";

/**
 * A failure while rendering shows a short message and a reload button instead of a
 * blank page. Outside the language hook on purpose: it must render when hooks can't.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const t = (key: string) => translate(i18n.language, key);
    return (
      <div role="alert" className="fixed inset-0 grid place-items-center bg-night p-6">
        <div className="max-w-sm rounded-2xl bg-paper px-6 py-5 text-ink shadow-lg">
          <p className="font-serif text-[18px]">{t("crash.title")}</p>
          <p className="mt-1 text-[13px] text-ink-soft">{this.state.error.message}</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="mt-4 rounded-full bg-accent px-4 py-1.5 text-[14px] text-paper hover:brightness-110"
          >
            {t("crash.reload")}
          </button>
        </div>
      </div>
    );
  }
}
