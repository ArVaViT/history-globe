import type { Camera, Engine, LayerVisibility } from "@hg/core";
import type { Locale } from "@hg/model";
import { useEffect } from "react";
import type { LoadedData } from "./data";

/** The view a host page sees and can set (docs/embed-protocol.md, v1). */
export interface EmbedView {
  readonly year: number;
  readonly locale: Locale;
  readonly place?: string;
  readonly tour?: string;
  readonly stop?: number;
  readonly ref?: string;
  /** Where the map looks: [lon, lat], zoom, pitch, bearing (rounded). */
  readonly camera?: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  readonly layers?: LayerVisibility;
}

/**
 * Inside another page: tell the host when the map is ready and when the view settles
 * (`hg:ready`, `hg:view-changed`), and take `hg:set-view` and `hg:set-locale` from it.
 * Only the view goes out, nothing about the reader, so any host may listen; messages
 * are taken only from the page that holds the frame.
 */
export function useEmbed(
  renderer:
    | {
        flyTo: (
          target: Partial<Camera> & { center: readonly [number, number] },
          ms?: number,
        ) => void;
      }
    | undefined,
  engine: Engine | undefined,
  data: LoadedData | null,
  ready: boolean,
  on: boolean,
): void {
  useEffect(() => {
    if (!on || !engine || !data || !ready || window.parent === window) return;
    // The protocol's code comes only in a frame: the globe on its own does not carry it.
    let live = true;
    let undo: (() => void) | undefined;
    import("./embed-protocol").then(
      ({ attachEmbed }) => {
        if (live) undo = attachEmbed(renderer, engine, data);
      },
      // The host is told, rather than left waiting for hg:ready.
      (e: unknown) => {
        window.parent.postMessage(
          {
            type: "hg:error",
            v: 1,
            code: "map",
            message: e instanceof Error ? e.message : String(e),
          },
          "*",
        );
      },
    );
    return () => {
      live = false;
      undo?.();
    };
  }, [renderer, engine, data, ready, on]);
}

/**
 * A verse the reader opened, told to the host page when the globe is embedded
 * (`hg:verse-clicked`), so a reading platform can open it in its own reader.
 */
export function notifyVerse(osis: string): void {
  if (
    window.parent === window ||
    !/(^|[?&])embed=1(&|$)|\/embed\/v1\/?$/.test(window.location.search + window.location.pathname)
  )
    return;
  window.parent.postMessage({ type: "hg:verse-clicked", v: 1, osis }, "*");
}

/** The globe could not start (data or WebGL): the host may show its own message. */
export function useEmbedError(code: "data" | "map" | null, message: string, on: boolean): void {
  useEffect(() => {
    if (!on || !code || window.parent === window) return;
    window.parent.postMessage({ type: "hg:error", v: 1, code, message }, "*");
  }, [code, message, on]);
}
