/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />
declare module 'virtual:react-router/server-build' {
  export * from '@react-router/dev/server-build';
}
declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}
// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';
