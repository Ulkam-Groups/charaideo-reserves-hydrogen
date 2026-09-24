import {expect, test, type Page} from '@playwright/test';
import {isolateCheckout} from './fastrr-guard';

async function addCurrentProductToCart(page: Page) {
  const cartAction = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === 'POST' && new URL(response.url()).pathname === '/cart';
  });

  await page.getByRole('button', {name: 'Add to cart'}).click();
  expect((await cartAction).ok()).toBe(true);
  await expect(page.getByRole('button', {name: 'Add to cart'})).toBeEnabled();
  await expect(page.getByRole('link', {name: /Cart 1 item/})).toBeVisible();
}

test('homepage and catalog hydrate without recoverable React errors', async ({
  page,
  context,
}) => {
  await isolateCheckout(context);
  const browserErrors: string[] = [];

  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /hydration|react error #(418|423)/i.test(message.text())
    ) {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  for (const path of ['/', '/collections/all']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    await page.waitForLoadState('networkidle');

    const chatScript = page.locator('script[data-shopify-chat-script]');
    await expect(chatScript).toHaveCount(1);
    await expect(chatScript).toHaveAttribute('type', 'module');
  }

  expect(browserErrors).toEqual([]);
});

test('disabled Sentry flag omits browser SDK and ingest requests', async ({
  page,
  context,
}) => {
  await isolateCheckout(context);
  const sentryRequests: string[] = [];
  await context.route(/sentry\.io/, async (route) => {
    sentryRequests.push(route.request().url());
    await route.abort();
  });
  page.on('request', (request) => {
    if (request.url().includes('monitoring.client-')) sentryRequests.push(request.url());
  });
  const response = await page.goto('/collections/all');
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="sentry-dsn"]')).toHaveCount(0);
  expect(response?.headers()['content-security-policy']).not.toContain(
    'ingest.sentry.io',
  );
  expect(sentryRequests).toEqual([]);
});

test('storefront CSP permits configured checkout and third-party assets', async ({
  page,
  context,
}) => {
  await isolateCheckout(context);
  const response = await page.goto('/collections/all');
  const csp = response?.headers()['content-security-policy'] ?? '';
  for (const origin of [
    'https://fastrr-boost-ui.pickrr.com',
    'https://sr-cdn.shiprocket.in',
    'https://otpless.com',
    'https://uptime2.fastrr.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://images.unsplash.com',
  ]) {
    expect(csp).toContain(origin);
  }
  await expect(page.locator('script[src*="fastrr-boost-ui.pickrr.com"]')).toHaveCount(1);
  await expect(page.locator('link[href*="fastrr-boost-ui.pickrr.com"]')).toHaveCount(1);
});

test('catalog to product to cart launches Fastrr with Shopify variant IDs', async ({
  page,
  context,
}) => {
  await isolateCheckout(context);
  await page.goto('/collections/all');
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  const product = page.locator('a[href^="/products/"]').first();
  await expect(product).toBeVisible();
  await product.click();
  await expect(page).toHaveURL(/\/products\//);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', {name: 'Buy now'})).toBeEnabled();
  expect(await page.evaluate(() => Boolean(window.shiprocketCheckoutEvents))).toBe(true);
  await page.getByRole('button', {name: 'Buy now'}).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__fastrrCalls.length))
    .toBe(1);
  const direct = await page.evaluate(() => (window as any).__fastrrCalls[0]);
  expect(direct).toMatchObject({type: 'product', products: [{quantity: 1}]});
  expect(direct.products[0].variantId).toMatch(/^\d+$/);

  await addCurrentProductToCart(page);
  await expect
    .poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'cart'))
    .toBe(true);
  await page.goto('/cart');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('button', {name: /Checkout with Shiprocket/}),
  ).toBeEnabled();
  await page.getByRole('button', {name: /Checkout with Shiprocket/}).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__fastrrCalls.length))
    .toBe(1);
  const cart = await page.evaluate(() => (window as any).__fastrrCalls[0]);
  expect(cart).toMatchObject({type: 'cart', products: [{quantity: 1}]});
  expect(cart.products[0].variantId).toBe(direct.products[0].variantId);
});

test('cart cookie keeps the cart after a new page load', async ({page, context}) => {
  await isolateCheckout(context);
  await page.goto('/collections/all');
  await page.locator('a[href^="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
  await page.waitForLoadState('networkidle');
  await addCurrentProductToCart(page);
  await expect
    .poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'cart'))
    .toBe(true);
  await page.reload();
  await page.goto('/cart');
  await expect(
    page.getByRole('button', {name: /Checkout with Shiprocket/}),
  ).toBeEnabled();
});

test('empty cart has no Fastrr launch control', async ({page, context}) => {
  await isolateCheckout(context);
  await page.goto('/cart');
  const main = page.locator('#main-content');
  await expect(main.getByText('Your table is waiting.')).toBeVisible();
  await expect(main.getByRole('button', {name: /Checkout with Shiprocket/})).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => (window as any).__fastrrCalls)).toEqual([]);
});

test('product checkout reports a mocked vendor launch failure', async ({
  page,
  context,
}) => {
  await isolateCheckout(context, '127.0.0.1', 'throw');
  await page.goto('/collections/all');
  await page.locator('a[href^="/products/"]').first().click();
  await expect(page.getByRole('button', {name: 'Buy now'})).toBeEnabled();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: 'Buy now'}).click();
  await expect(page.getByRole('alert')).toContainText(
    'Checkout is temporarily unavailable',
  );
  expect(await page.evaluate(() => (window as any).__fastrrCalls.length)).toBe(1);
});

test('product checkout reports a missing vendor script', async ({page, context}) => {
  await isolateCheckout(context, '127.0.0.1', 'missing');
  await page.goto('/collections/all');
  await page.locator('a[href^="/products/"]').first().click();
  await expect(page.getByRole('button', {name: 'Buy now'})).toBeEnabled();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: 'Buy now'}).click();
  await expect(page.getByRole('alert')).toContainText(
    'Checkout is temporarily unavailable',
  );
  expect(await page.evaluate(() => (window as any).__fastrrCalls.length)).toBe(0);
});

test('cart quantity and UTM parameters are passed to the mocked Fastrr launch', async ({
  page,
  context,
}) => {
  await isolateCheckout(context);
  await page.goto('/collections/all');
  await page.locator('a[href^="/products/"]').first().click();
  await expect(page.getByRole('button', {name: 'Buy now'})).toBeEnabled();
  await page.waitForLoadState('networkidle');
  await addCurrentProductToCart(page);
  await expect
    .poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'cart'))
    .toBe(true);
  await page.goto('/cart?utm_source=ci&utm_medium=e2e&ignored=1');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: 'Increase quantity'}).click();
  await expect(page.locator('#main-content').getByText('Quantity: 2')).toBeVisible();
  await expect(
    page.getByRole('button', {name: /Checkout with Shiprocket/}),
  ).toBeEnabled();
  await page.getByRole('button', {name: /Checkout with Shiprocket/}).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__fastrrCalls.length))
    .toBe(1);
  const payload = await page.evaluate(() => (window as any).__fastrrCalls[0]);
  expect(payload.type).toBe('cart');
  expect(payload.products).toMatchObject([{quantity: 2}]);
  expect(payload.utmParams).toBe('utm_source=ci&utm_medium=e2e');
  expect(payload).not.toHaveProperty('couponCode');
});
