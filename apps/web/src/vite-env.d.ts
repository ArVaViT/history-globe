/// <reference types="vite/client" />

/** The files a save for use offline fetches, written by the build (vite.config.ts). */
declare module "virtual:offline-files" {
  export const bytes: number;
  export const files: readonly string[];
}
