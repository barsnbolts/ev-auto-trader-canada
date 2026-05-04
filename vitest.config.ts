import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config — mirrors tsconfig.json paths so `@/...` imports resolve in
// tests the same way they do in the Next build.
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: [
      // Order matters: longest prefix first
      { find: /^@\/data\/(.*)/, replacement: path.resolve(__dirname, "./data/$1") },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
  },
});
