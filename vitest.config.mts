import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "next/font/google": fileURLToPath(new URL("./src/test/next-font-google.ts", import.meta.url)),
    },
  },
  test: { testTimeout: 15_000 },
});
