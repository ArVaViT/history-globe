import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.vercel/**",
      // Generated folders, and the released copies of hg-places.js that stay as published.
      "apps/web/public/*/**",
      "apps/web/public/hg-places-*.js",
      "pipeline/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  { files: ["*.js"], ...tseslint.configs.disableTypeChecked },
  // The browser checks and the scripts that drive a browser (tour-images.mjs): plain
  // JavaScript run by Node, the page's code inside `evaluate`.
  {
    files: ["e2e/**/*.mjs", "scripts/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: false, project: null },
    },
  },
  // The hand-written scripts the site serves as they are: no build, no types.
  {
    files: ["apps/web/public/*.js"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser },
      parserOptions: { projectService: false, project: null },
    },
  },
  {
    files: ["apps/web/public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  prettier,
);
