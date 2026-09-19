import type {BrowserContext} from '@playwright/test';

type MockMode = 'success' | 'throw' | 'missing';

/** Mock Fastrr's browser script; block all other off-host browser requests. */
export async function isolateCheckout(
  context: BrowserContext,
  allowedHost = '127.0.0.1',
  mode: MockMode = 'success',
) {
  await context.addInitScript(() => {
    Object.assign(window, {__fastrrCalls: []});
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === allowedHost || url.hostname === 'localhost') {
      await route.continue();
    } else if (
      url.origin === 'https://fastrr-boost-ui.pickrr.com' &&
      url.pathname === '/assets/js/channels/shopify.js'
    ) {
      const body =
        mode === 'missing'
          ? ''
          : `window.shiprocketCheckoutEvents = {
              buyDirect(payload) {
                window.__fastrrCalls.push(payload);
                ${mode === 'throw' ? "throw new Error('Mock Fastrr launch failure');" : ''}
              }
            };`;
      await route.fulfill({status: 200, contentType: 'application/javascript', body});
    } else if (
      url.origin === 'https://fastrr-boost-ui.pickrr.com' &&
      url.pathname === '/assets/styles/shopify.css'
    ) {
      await route.fulfill({status: 200, contentType: 'text/css', body: ''});
    } else {
      await route.abort();
    }
  });
}
