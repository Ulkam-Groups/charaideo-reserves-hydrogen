import {expect, test, type Page} from '@playwright/test';
import {isolateRazorpayCheckout} from './razorpay-guard';

async function addCurrentProductToCart(page: Page) {
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await expect(page.getByRole('button', {name: 'Add to cart'})).toBeEnabled();
  await expect(page.getByRole('link', {name: /Cart 1 item/})).toBeVisible();
}

test('Razorpay toggle isolates assets and launches product and cart checkout', async ({
  page,
  context,
}) => {
  const requests: Array<{path: string; fields: Record<string, string>}> = [];
  await isolateRazorpayCheckout(context, requests);

  const response = await page.goto('/collections/all');
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain('https://checkout.razorpay.com');
  expect(csp).toContain('https://checkout-static-next.razorpay.com');
  expect(csp).not.toContain('fastrr-boost-ui.pickrr.com');
  await expect(page.locator('script[src*="checkout.razorpay.com"]')).toHaveCount(1);
  await expect(page.locator('script[src*="fastrr-boost-ui.pickrr.com"]')).toHaveCount(0);

  await page.locator('a[href^="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
  await expect(page.getByRole('button', {name: 'Buy now'})).toBeEnabled();
  expect(await page.evaluate(() => Boolean(window.Razorpay))).toBe(true);
  expect(await page.evaluate(() => Boolean(window.shiprocketCheckoutEvents))).toBe(false);

  await page.getByRole('button', {name: 'Buy now'}).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].fields.source).toBe('product');
  expect(JSON.parse(requests[0].fields.products)).toMatchObject([{quantity: 1}]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const instance = (window as any).__razorpayInstances[0];
        return instance?.opened === true;
      }),
    )
    .toBe(true);
  const productOptions = await page.evaluate(() => {
    const {handler: _handler, ...options} = (window as any).__razorpayOptions[0];
    return options;
  });
  expect(productOptions).toMatchObject({
    key: 'rzp_test_e2e',
    one_click_checkout: true,
    name: 'Charaideo Reserves',
    order_id: 'order_e2e1',
    show_coupons: false,
  });

  await addCurrentProductToCart(page);
  await page.goto('/cart?utm_source=ci&utm_medium=e2e');
  await expect(page.getByRole('button', {name: /Checkout with Razorpay/})).toBeEnabled();
  await page.getByRole('button', {name: /Checkout with Razorpay/}).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].fields.source).toBe('cart');
  expect(requests[1].fields.utmParams).toBe('utm_source=ci&utm_medium=e2e');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const instance = (window as any).__razorpayInstances[1];
        return instance?.opened === true;
      }),
    )
    .toBe(true);

  await page.evaluate(() => {
    (window as any).__razorpayOptions[1].handler({
      razorpay_order_id: 'order_e2e2',
      razorpay_payment_id: 'pay_e2e2',
      razorpay_signature: 'a'.repeat(64),
    });
  });
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2]).toEqual({
    path: '/api/checkout/razorpay/verify',
    fields: {
      razorpay_order_id: 'order_e2e2',
      razorpay_payment_id: 'pay_e2e2',
      razorpay_signature: 'a'.repeat(64),
    },
  });
  await expect(page).toHaveURL(/\/cart\?razorpay_verified=1$/);
});
