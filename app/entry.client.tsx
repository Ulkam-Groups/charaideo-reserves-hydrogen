import {HydratedRouter} from 'react-router/dom';
import {startTransition, StrictMode} from 'react';
import {hydrateRoot} from 'react-dom/client';
import {NonceProvider} from '@shopify/hydrogen';
import {prepareMonitoringSignals, recordHydrationFailure, installMonitoringRecorder} from '~/lib/monitoring-signals';

if (document.querySelector('meta[name="sentry-dsn"]')) {
  prepareMonitoringSignals();
  void import('~/lib/monitoring.client')
    .then(({initBrowserMonitoring}) => initBrowserMonitoring())
    .catch(() => installMonitoringRecorder(null));
}

if (!window.location.origin.includes('webcache.googleusercontent.com')) {
  startTransition(() => {
    // Extract nonce from existing script tags
    const existingNonce =
      document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;

    hydrateRoot(
      document,
      <StrictMode>
        <NonceProvider value={existingNonce}>
          <HydratedRouter />
        </NonceProvider>
      </StrictMode>,
      {
        onRecoverableError(error, info) {
          recordHydrationFailure();
          console.error(error);
          if (info.componentStack) {
            console.error('Hydration component stack:', info.componentStack);
          }
        },
      },
    );
  });
}
