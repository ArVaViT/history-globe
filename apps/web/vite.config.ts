import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: "es2023", sourcemap: true },
  // MapLibre 6 loads its worker with new URL("./maplibre-gl-worker.mjs", import.meta.url);
  // pre-bundling moves the main file away from the worker and breaks that URL.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
