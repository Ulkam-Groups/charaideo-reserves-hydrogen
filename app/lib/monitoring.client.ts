import * as Sentry from '@sentry/browser';
import {metrics} from '@sentry/core';
import {installMonitoringRecorder} from './monitoring-signals';

export function initBrowserMonitoring() {
  const dsn = document.querySelector<HTMLMetaElement>('meta[name="sentry-dsn"]')?.content;
  if (!dsn) {
    installMonitoringRecorder(null);
    return;
  }
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'https:' || !/(^|\.)sentry\.io$/.test(url.hostname)) {
      installMonitoringRecorder(null);
      return;
    }
  } catch {
    installMonitoringRecorder(null);
    return;
  }

  Sentry.init({
    dsn,
    environment: document.querySelector<HTMLMetaElement>('meta[name="sentry-environment"]')?.content || 'production',
    defaultIntegrations: false,
    integrations: [],
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      delete event.extra;
      return event;
    },
  });
  installMonitoringRecorder((signal) => {
    if (signal.kind === 'hydration') {
      Sentry.captureMessage('storefront.hydration.failure', 'error');
      return;
    }
    metrics.count('fastrr.launch.count', 1, {attributes: {source: signal.source, result: signal.result}});
    if (signal.result !== 'requested') {
      Sentry.captureMessage('fastrr.launch.failure', {
        level: 'error',
        tags: {source: signal.source, result: signal.result},
      });
    }
  });
  window.addEventListener('error', (event) => {
    const knownNames = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError'];
    const errorName = knownNames.includes(event.error?.name) ? event.error.name : 'OtherError';
    try {
      Sentry.captureMessage('storefront.browser.error', {
        level: 'error',
        tags: {errorName},
      });
    } catch {
      // Browser monitoring must not cause another application error.
    }
  });
  window.addEventListener('unhandledrejection', () => {
    try {
      Sentry.captureMessage('storefront.browser.unhandled_rejection', 'error');
    } catch {
      // Browser monitoring must not cause another application error.
    }
  });
}
