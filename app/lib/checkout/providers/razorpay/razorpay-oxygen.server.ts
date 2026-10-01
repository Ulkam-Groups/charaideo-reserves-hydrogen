type Options = {
  key_id: string;
  key_secret: string;
  hostUrl?: string;
};

type FetchBackedApi = {
  rq: {
    defaults: {
      adapter: string;
      env: {
        fetch: typeof globalThis.fetch;
        Request: null;
        Response: null;
      };
    };
  };
};

/**
 * Oxygen entry point for the official Razorpay SDK.
 *
 * The package's main class eagerly imports every SDK resource, including
 * Node-only helpers. This adapter initializes only the official API, Orders,
 * and Payments modules used by this storefront.
 */
export default class RazorpayOxygen {
  orders;
  payments;

  constructor(options: Options) {
    const api = new Api({
      hostUrl: options.hostUrl ?? 'https://api.razorpay.com',
      ua: 'razorpay-node@2.9.8',
      key_id: options.key_id,
      key_secret: options.key_secret,
    });
    // Oxygen is a Worker runtime. Use native fetch without Axios constructing
    // a browser-style Request whose initializer is not fully supported by workerd.
    const request = (api as unknown as FetchBackedApi).rq.defaults;
    request.adapter = 'fetch';
    request.env = {
      fetch: globalThis.fetch,
      Request: null,
      Response: null,
    };
    this.orders = createOrders(api);
    this.payments = createPayments(api);
  }
}
import Api from 'razorpay/dist/api.js';
import createOrders from 'razorpay/dist/resources/orders.js';
import createPayments from 'razorpay/dist/resources/payments.js';
