import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".direnv/**"],
    globalSetup: ["./vitest.global-setup.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
