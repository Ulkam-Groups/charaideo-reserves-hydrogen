/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />
declare module 'virtual:react-router/server-build' {
  export * from '@react-router/dev/server-build';
}
declare global {
  interface Env {
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    RAZORPAY_WEBHOOK_SECRET?: string;
    RAZORPAY_CUSTOM_SHIPPING_READY?: string;
    SHOPIFY_ADMIN_API_TOKEN?: string;
    SHOPIFY_ADMIN_CLIENT_ID?: string;
    SHOPIFY_ADMIN_CLIENT_SECRET?: string;
    JUDGEME_SHOP_DOMAIN?: string;
    JUDGEME_PUBLIC_API_TOKEN?: string;
    JUDGEME_PRIVATE_API_TOKEN?: string;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}
// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';
