import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
    ],
    // The tests read every language, as the build scripts do (locale-data.ts).
    setupFiles: ["./vitest.setup.ts"],
    // The app's code runs here outside a browser. Node 25 and later define a localStorage that
    // warns on every read unless a storage file is given; without it the tests see none, as on
    // Node 24, and the app's own fallback (apps/web/src/storage.ts) is what they test.
    execArgv: ["--no-experimental-webstorage"],
  },
});
