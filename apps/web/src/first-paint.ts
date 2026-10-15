/**
 * Resolves once the page has painted its first content (the first screen of index.html),
 * or after two seconds, whichever comes first; at once where the browser does not report
 * paints or the tab is not shown.
 *
 * The map's data and MapLibre wait for it. Started earlier, on a phone they held the first
 * frame back: MapLibre's start-up (its shaders above all) takes the main thread and the GPU
 * for a second or more, and the data are megabytes that share the line with the stylesheet
 * and the title's font. On a slow network the first frame comes before the scripts anyway,
 * so the wait costs the map next to nothing.
 */
export function firstPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof PerformanceObserver === "undefined" ||
      !PerformanceObserver.supportedEntryTypes.includes("paint") ||
      document.visibilityState === "hidden"
    ) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      done();
    }, 2000);
    const observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName("first-contentful-paint").length > 0) done();
    });
    function done() {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    }
    observer.observe({ type: "paint", buffered: true });
  });
}
