import { defineConfig, devices } from '@playwright/test';

// E2E suite against the dockerized app (podman compose). The stack is
// started automatically if it isn't already running.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8082',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'podman compose -f ../docker-compose.yml up -d',
    url: 'http://localhost:8082',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
