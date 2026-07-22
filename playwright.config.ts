import { defineConfig, devices } from '@playwright/test';
import { e2eConfig } from './support/config';

export default defineConfig({
  testDir: './',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  outputDir: './reports/playwright-artifacts',
  use: {
    baseURL: e2eConfig.baseUrl,
    browserName: 'chromium',
    headless: e2eConfig.headless,
    screenshot: 'only-on-failure',
    video: e2eConfig.recordVideo ? 'on' : 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
