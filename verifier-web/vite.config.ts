import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` is the gh-pages subpath. Repo "sworn" deployed at
// https://yonkoo11.github.io/sworn/. Local dev (`pnpm dev`) uses Vite's
// default behaviour at /, so the base only affects production builds.
export default defineConfig({
  base: process.env.SWORN_PUBLIC_BASE ?? "/sworn/",
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { target: "es2022" },
});
