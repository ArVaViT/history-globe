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
import { readUrl, startLocale } from "./url";
import { readPref, writePref } from "./storage";

const RELOADED_KEY = "hg:reloaded";

// A tab opened before a deploy asks for a chunk the new build no longer has: load the new
// build once instead of the error screen (the flag stops a reload loop).
window.addEventListener("vite:preloadError", (e) => {
  if (readPref(RELOADED_KEY, "session")) return;
  writePref(RELOADED_KEY, "1", "session");
  // Storage refused: no flag to stop a loop, so no reload.
  if (!readPref(RELOADED_KEY, "session")) return;
  e.preventDefault();
  window.location.reload();
});
// A page that has stood for a while loaded its build: a later deploy may reload it again.
window.setTimeout(() => {
  writePref(RELOADED_KEY, null, "session");
}, 15_000);

// What has been fetched stays for use without a network (public/sw.js).
registerOffline();

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing");
const link = readUrl();
// The page's language is in before the first frame, so its words never flash in English.
void i18n.changeLanguage(startLocale(link)).finally(() => {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App link={link} />
      </ErrorBoundary>
    </StrictMode>,
  );
});
