import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.js"],
    environment: "node",
    globals: false,
    testTimeout: 10000,
  },
});
