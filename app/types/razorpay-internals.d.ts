declare module 'razorpay/dist/api.js' {
  export default class Api {
    constructor(options: {
      hostUrl: string;
      ua: string;
      key_id: string;
      key_secret: string;
    });
  }
}

declare module 'razorpay/dist/resources/orders.js' {
  import type Razorpay from 'razorpay';
  export default function createOrders(
    api: unknown,
  ): InstanceType<typeof Razorpay>['orders'];
}

declare module 'razorpay/dist/resources/payments.js' {
  import type Razorpay from 'razorpay';
  export default function createPayments(
    api: unknown,
  ): InstanceType<typeof Razorpay>['payments'];
}
