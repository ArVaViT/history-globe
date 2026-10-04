import "@fontsource-variable/golos-text";
import "@fontsource-variable/literata";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { i18n } from "./i18n";
import { registerOffline } from "./offline";
import { countVisits } from "./visits";
import { readUrl } from "./url";
import { DEFAULT_STATE } from "@hg/core";

// A tab opened before a deploy asks for a chunk the new build no longer has: load the new
// build once instead of the error screen (the flag stops a reload loop).
window.addEventListener("vite:preloadError", (e) => {
  try {
    if (sessionStorage.getItem("hg:reloaded")) return;
    sessionStorage.setItem("hg:reloaded", "1");
  } catch {
    return;
  }
  e.preventDefault();
  window.location.reload();
});
// A page that has stood for a while loaded its build: a later deploy may reload it again.
window.setTimeout(() => {
  try {
    sessionStorage.removeItem("hg:reloaded");
  } catch {
    // Storage blocked: nothing was set either.
  }
}, 15_000);

// What has been fetched stays for use without a network (public/sw.js).
registerOffline();
countVisits();

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing");
// The page's language is in before the first frame, so its words never flash in English.
void i18n.changeLanguage(readUrl().locale ?? DEFAULT_STATE.locale).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});
