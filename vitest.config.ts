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
  },
});
