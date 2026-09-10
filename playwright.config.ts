import { defineConfig, devices } from '@playwright/test';

import { EnvConfig } from './src/common-utils/helpers/EnvConfig';

/**
 * Sign-in framework for Tableau Cloud and Power BI.
 *
 * Each project establishes a session and persists it under auth/, so anything
 * built on top starts already signed in.
 *
 *   tableau              Tableau visual-data extraction
 *   powerbi              Power BI visual-data extraction
 *   tableau-auth-setup   scripted Tableau sign-in    -> auth/tableau.json
 *   powerbi-auth-setup   scripted Entra ID sign-in   -> auth/powerbi.json
 *   powerbi-auth-manual  hand-driven sign-in for MFA -> auth/powerbi.json
 */
const uiUse = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1520, height: 720 },
  actionTimeout: EnvConfig.defaultTimeout,
  navigationTimeout: EnvConfig.navigationTimeout,
  ignoreHTTPSErrors: true,
  acceptDownloads: true,
  screenshot: 'only-on-failure' as const,
  video: 'retain-on-failure' as const,
  trace: EnvConfig.trace,
};

export default defineConfig({
  testDir: './src/apps/bi-migration/ui',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: EnvConfig.retries,
  workers: EnvConfig.workers,
  timeout: 15 * 60 * 1000,
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
  ],
  use: {
    headless: EnvConfig.isHeadless,
    launchOptions: { slowMo: EnvConfig.slowMo, args: ['--disable-dev-shm-usage'] },
    ...uiUse,
  },

  projects: [
    {
      // Feature specs. Depends on the auth setup, so the saved session is fresh.
      name: 'tableau',
      testDir: './src/apps/bi-migration/ui/tests/tableau',
      dependencies: ['tableau-auth-setup'],
      use: uiUse,
    },
    {
      name: 'tableau-auth-setup',
      testMatch: /global-setup\/tableau-auth\.setup\.ts/,
      use: uiUse,
    },
    {
      // Feature specs. No auth dependency on purpose: this tenant's MFA cannot
      // be automated, so the session comes from `npm run auth:powerbi:manual`
      // and is reused until it expires.
      name: 'powerbi',
      testDir: './src/apps/bi-migration/ui/tests/powerbi',
      use: uiUse,
    },
    {
      name: 'powerbi-auth-setup',
      testMatch: /global-setup\/powerbi-auth\.setup\.ts$/,
      use: uiUse,
    },
    {
      // Hand-driven sign-in for tenants whose MFA cannot be automated.
      // Always headed: the whole point is that a human completes it.
      name: 'powerbi-auth-manual',
      testMatch: /global-setup\/powerbi-manual-auth\.setup\.ts/,
      use: { ...uiUse, headless: false },
    },
  ],
});
