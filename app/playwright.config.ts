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
    baseURL: 'http://localhost:8084',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The full e2e stack: test backend on 8083 + app baked with the test
    // URL. --build keeps the image's baked EXPO_PUBLIC_PAWLY_URL in sync
    // with the test override.
    command: 'podman compose -f ../docker-compose.yml -f ../docker-compose.test.yml up -d --build app backend',
    url: 'http://localhost:8084',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
