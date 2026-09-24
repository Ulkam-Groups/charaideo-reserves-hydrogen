type Options = {
  key_id: string;
  key_secret: string;
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
      hostUrl: 'https://api.razorpay.com',
      ua: 'razorpay-node@2.9.8',
      key_id: options.key_id,
      key_secret: options.key_secret,
    });
    this.orders = createOrders(api);
    this.payments = createPayments(api);
  }
}
import Api from 'razorpay/dist/api.js';
import createOrders from 'razorpay/dist/resources/orders.js';
import createPayments from 'razorpay/dist/resources/payments.js';
