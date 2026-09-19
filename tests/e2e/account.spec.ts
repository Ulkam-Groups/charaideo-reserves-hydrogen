import {expect, test} from '@playwright/test';
import {isolateCheckout} from './fastrr-guard';

const accountURL = process.env.E2E_ACCOUNT_BASE_URL;
const storageState = process.env.E2E_ACCOUNT_STORAGE_STATE;
const canRun = Boolean(
  accountURL && storageState && new URL(accountURL).hostname.endsWith('.myshopify.dev'),
);

test.describe('Customer Account on a dedicated test storefront', () => {
  test.skip(!canRun, 'Set a .myshopify.dev test URL and E2E_ACCOUNT_STORAGE_STATE');
  test.beforeEach(async ({context}) => {
    await isolateCheckout(context, new URL(accountURL!).hostname);
  });

  test('authenticated customer can sign out and sees the sign-in path', async ({
    page,
  }) => {
    await page.goto('/account/profile');
    await expect(page.getByRole('heading', {name: 'My profile'})).toBeVisible();
    await page.getByRole('button', {name: /Sign out/}).click();
    await page.goto('/sign-in');
    await expect(page.getByRole('link', {name: /Continue to sign in/})).toHaveAttribute(
      'href',
      '/account/login',
    );
    const response = await page.request.get('/account/login', {maxRedirects: 0});
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers().location).toMatch(/^https:\/\//);
  });

  test('profile updates persist across reload', async ({page}) => {
    test.skip(
      process.env.E2E_ACCOUNT_ALLOW_WRITES !== '1',
      'Opt in to test account writes',
    );
    await page.goto('/account/profile');
    await page.getByLabel('First name').fill('Playwright');
    await page.getByRole('button', {name: 'Update', exact: true}).click();
    await expect(page.getByRole('status')).toContainText('Profile updated');
    await page.reload();
    await expect(page.getByLabel('First name')).toHaveValue('Playwright');
  });

  test('address can be created, updated, and deleted', async ({page}) => {
    test.skip(
      process.env.E2E_ACCOUNT_ALLOW_WRITES !== '1',
      'Opt in to test account writes',
    );
    await page.goto('/account/addresses');
    const newAddress = page.locator('.account-address-new');
    await newAddress.getByLabel('First name').fill('Playwright');
    await newAddress.getByLabel('Last name').fill('Test');
    await newAddress.getByLabel('Address line 1').fill('1 Test Street');
    await newAddress.getByLabel('City').fill('Guwahati');
    await newAddress.getByLabel('State / Province').fill('AS');
    await newAddress.getByLabel('Postal code').fill('781001');
    await newAddress.getByLabel('Country code').fill('IN');
    await newAddress.getByRole('button', {name: 'Save address'}).click();
    const savedAddress = page
      .locator('.account-address-saved .account-address-form')
      .filter({
        hasText: 'Playwright Test',
      });
    await expect(savedAddress).toBeVisible();
    await savedAddress.getByLabel('City').fill('Dispur');
    await savedAddress.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(savedAddress.getByLabel('City')).toHaveValue('Dispur');
    await savedAddress.getByRole('button', {name: 'Delete'}).click();
    await expect(savedAddress).toHaveCount(0);
  });
});
