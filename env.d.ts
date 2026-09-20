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
        React.HTMLAttributes<HTMLElement> & {'store-domain': string},
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
    PUBLIC_SHOPIFY_CHAT_SHOP?: string;
    PUBLIC_FASTRR_SELLER_DOMAIN?: string;
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
