import { defineConfig } from "vitest/config";

// O gateway usa Vitest; os testes de distribuição em deploy/ usam node:test.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "tests/**/*.test.mjs"] },
});
