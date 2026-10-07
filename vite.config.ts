import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(process.cwd(), "client"),
  build: { outDir: path.resolve(process.cwd(), "dist/public"), emptyOutDir: true },
});
