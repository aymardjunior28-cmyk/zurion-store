'use strict';

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 1366 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node back/server.js',
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
