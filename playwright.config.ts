import {defineConfig, devices} from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const storefrontPort = 4174;
const storefrontURL = `http://127.0.0.1:${storefrontPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {timeout: 10_000},
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    {
      name: 'storefront',
      testMatch: /storefront\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
        launchOptions: process.env.E2E_BROWSER_EXECUTABLE
          ? {executablePath: process.env.E2E_BROWSER_EXECUTABLE}
          : undefined,
      },
    },
    {
      name: 'account',
      testMatch: /account\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_ACCOUNT_BASE_URL || baseURL,
        storageState: process.env.E2E_ACCOUNT_STORAGE_STATE || undefined,
        launchOptions: process.env.E2E_BROWSER_EXECUTABLE
          ? {executablePath: process.env.E2E_BROWSER_EXECUTABLE}
          : undefined,
      },
    },
  ],
  webServer: [
    {
      command: 'node tests/e2e/storefront-api-mock.mjs',
      url: `${storefrontURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {E2E_STOREFRONT_PORT: String(storefrontPort)},
    },
    {
      command: `npm run dev:local -- --config vite.e2e.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
      url: `${baseURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PUBLIC_STORE_DOMAIN: storefrontURL,
        PUBLIC_STOREFRONT_API_TOKEN: 'e2e-token',
        PRIVATE_STOREFRONT_API_TOKEN: '',
        PUBLIC_STOREFRONT_ID: '0',
        PUBLIC_FASTRR_SELLER_DOMAIN: 'e2e.invalid',
        PUBLIC_CHECKOUT_DOMAIN: 'checkout.invalid',
        SESSION_SECRET: 'playwright-test-session-secret-32-characters',
      },
    },
  ],
});
