/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />
declare module 'virtual:react-router/server-build' {
  export * from '@react-router/dev/server-build';
}
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'shopify-store': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'store-domain': string;
          country?: string;
          language?: string;
        },
        HTMLElement
      >;
      'shopify-chat': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          open?: boolean | string;
          mode?: string;
          'mode-switch'?: string;
          'data-identity-fp'?: string;
        },
        HTMLElement
      >;
    }
  }

  interface Env {
    WRIT_TO_CUSTOMER_CLIENT_ID?: string;
    WRIT_TO_CUSTOMER_CLIENT_SECRET?: string;
    PUBLIC_SHOPIFY_CHAT_SHOP?: string;
    CHECKOUT_PROVIDER?: string;
    PUBLIC_FASTRR_SELLER_DOMAIN?: string;
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    RAZORPAY_WEBHOOK_SECRET?: string;
    RAZORPAY_BUSINESS_NAME?: string;
    RAZORPAY_SHIPPING_FEE_PAISE?: string;
    RAZORPAY_COD_ENABLED?: string;
    RAZORPAY_COD_FEE_PAISE?: string;
    SHOPIFY_ADMIN_CLIENT_ID?: string;
    SHOPIFY_ADMIN_CLIENT_SECRET?: string;
    SHOPIFY_ADMIN_STORE_DOMAIN?: string;
    SHIPROCKET_API_TOKEN?: string;
    SHIPROCKET_API_EMAIL?: string;
    SHIPROCKET_API_PASSWORD?: string;
    SHIPROCKET_PICKUP_PINCODE?: string;
    SHIPROCKET_DEFAULT_WEIGHT_KG?: string;
    JUDGEME_SHOP_DOMAIN?: string;
    JUDGEME_PUBLIC_API_TOKEN?: string;
    JUDGEME_PRIVATE_API_TOKEN?: string;
    SENTRY_DSN?: string;
    SENTRY_ENABLED?: string;
    SENTRY_ENVIRONMENT?: string;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}
// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';
