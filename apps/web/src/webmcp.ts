/**
 * WebMCP, an experiment: the map's read-only tools for AI agents in the reader's browser
 * (agent-tools.ts). The API is `document.modelContext` since Chrome 150 and was
 * `navigator.modelContext` before; both are looked for. Where neither is, nothing loads.
 *
 * Chrome offers it behind a flag or in an origin trial: a trial token goes in the app's page
 * at build time from WEBMCP_ORIGIN_TRIAL (vite.config.ts), never in the code.
 */
import type { AgentContext, ModelContextLike } from "./agent-tools";

/** The browser's model context, if it has one. */
export function modelContext(
  doc: object | undefined = globalThis.document,
  nav: object | undefined = globalThis.navigator,
): ModelContextLike | undefined {
  for (const host of [doc, nav]) {
    const mc = (host as { modelContext?: unknown } | undefined)?.modelContext;
    if (
      mc &&
      typeof mc === "object" &&
      typeof (mc as { registerTool?: unknown }).registerTool === "function"
    )
      return mc as ModelContextLike;
  }
  return undefined;
}

/**
 * Offers the tools once the data is loaded; the returned function takes them away (a new
 * data load, the app unmounting). In a browser without WebMCP it does nothing at all.
 */
export function offerAgentTools(ctx: AgentContext): () => void {
  const mc = modelContext();
  if (!mc) return () => undefined;
  const ac = new AbortController();
  void import("./agent-tools").then(
    (m) => m.registerAgentTools(mc, ctx, ac.signal),
    () => undefined,
  );
  return () => {
    ac.abort();
  };
}
