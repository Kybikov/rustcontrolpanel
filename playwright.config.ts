import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.UI_SMOKE_PORT ?? 4174);
const apiBaseUrl = process.env.UI_SMOKE_API_BASE_URL ?? "http://127.0.0.1:18080";

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node server.mjs",
    env: {
      API_BASE_URL: apiBaseUrl,
      PORT: String(port),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    url: `http://127.0.0.1:${port}/healthz`,
  },
});
