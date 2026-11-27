// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

/// <reference types="vite/client" />

/** The files a save for use offline fetches, written by the build (vite.config.ts). */
declare module "virtual:offline-files" {
  export const bytes: number;
  export const files: readonly string[];
}
