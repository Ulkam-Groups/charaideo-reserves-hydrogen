import type {BrowserContext, Request} from '@playwright/test';

type CapturedRequest = {path: string; fields: Record<string, string>};

/** Mock Razorpay's browser boundary; block every unrelated off-host request. */
export async function isolateRazorpayCheckout(
  context: BrowserContext,
  requests: CapturedRequest[],
) {
  await context.addInitScript(() => {
    Object.assign(window, {
      __razorpayInstances: [],
      __razorpayOptions: [],
    });
  });

  const capture = (request: Request) => {
    requests.push({
      path: new URL(request.url()).pathname,
      fields: Object.fromEntries(new URLSearchParams(request.postData() ?? '')),
    });
  };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/checkout/razorpay/order') {
      capture(request);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          keyId: 'rzp_test_e2e',
          orderId: `order_e2e${requests.length}`,
          businessName: 'Charaideo Reserves',
        }),
      });
    } else if (url.pathname === '/api/checkout/razorpay/verify') {
      capture(request);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({redirectTo: '/cart?razorpay_verified=1'}),
      });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else if (
      url.origin === 'https://checkout.razorpay.com' &&
      url.pathname === '/v1/magic-checkout.js'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.Razorpay = class {
          constructor(options) {
            this.options = options;
            this.events = {};
            window.__razorpayOptions.push(options);
            window.__razorpayInstances.push(this);
          }
          on(event, handler) { this.events[event] = handler; }
          open() { this.opened = true; }
        };`,
      });
    } else if (
      url.origin === 'https://cdn.shopify.com' &&
      url.pathname === '/storefront/web-components/chat.js'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'export {};',
      });
    } else {
      await route.abort();
    }
  });
}
