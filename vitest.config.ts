import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["engine/**/*.test.ts", "components/**/*.test.tsx"],
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
