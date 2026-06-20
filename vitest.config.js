import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      all: true,
      include: ["src/**/*.js"],
      exclude: ["src/**/__tests__/**", "src/style.css"]
    }
  }
});
