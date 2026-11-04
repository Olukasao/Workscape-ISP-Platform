import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:15178",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/server.mjs",
      url: "http://127.0.0.1:14179/__test/state",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev:web -- --port 15178",
      url: "http://127.0.0.1:15178",
      reuseExistingServer: false,
    },
  ],
});
