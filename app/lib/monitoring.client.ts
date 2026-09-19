import * as Sentry from '@sentry/browser';
import {metrics} from '@sentry/core';
import {hydrationDiagnostic, installMonitoringRecorder} from './monitoring-signals';

declare const __SENTRY_RELEASE__: string;

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
    release: __SENTRY_RELEASE__ || undefined,
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
      Sentry.captureEvent({
        message: 'storefront.hydration.failure',
        level: 'error',
        fingerprint: ['storefront.hydration.failure', signal.diagnostic.reactErrorCode, signal.diagnostic.routeGroup],
        tags: {
          reactErrorCode: signal.diagnostic.reactErrorCode,
          errorName: signal.diagnostic.errorName,
          routeGroup: signal.diagnostic.routeGroup,
        },
        contexts: {
          hydration: {
            componentStack: signal.diagnostic.componentStack,
            scriptStack: signal.diagnostic.scriptStack,
            incidentId: signal.diagnostic.incidentId,
          },
        },
        ...(signal.diagnostic.frames.length ? {
          exception: {values: [{
            type: 'HydrationError',
            value: `React hydration #${signal.diagnostic.reactErrorCode}`,
            stacktrace: {frames: signal.diagnostic.frames},
          }]},
        } : {}),
      });
      return;
    }
    metrics.count('fastrr.launch.count', 1, {attributes: {source: signal.source, result: signal.result}});
    if (signal.result !== 'requested') {
      Sentry.captureMessage('fastrr.launch.failure', {
        level: 'error',
        fingerprint: ['fastrr.launch.failure', signal.source, signal.result],
        tags: {source: signal.source, result: signal.result, routeGroup: signal.diagnostic?.routeGroup || 'unknown', errorName: signal.diagnostic?.errorName || 'none'},
        contexts: signal.diagnostic ? {diagnostic: {scriptStack: signal.diagnostic.scriptStack}} : undefined,
      });
    }
  });
  window.addEventListener('error', (event) => {
    const diagnostic = hydrationDiagnostic(event.error, undefined, window.location.pathname, window.location.origin);
    try {
      Sentry.captureMessage('storefront.browser.error', {
        level: 'error',
        fingerprint: ['storefront.browser.error', diagnostic.errorName, diagnostic.reactErrorCode, diagnostic.routeGroup],
        tags: {errorName: diagnostic.errorName, reactErrorCode: diagnostic.reactErrorCode, routeGroup: diagnostic.routeGroup},
        contexts: {diagnostic: {scriptStack: diagnostic.scriptStack}},
      });
    } catch {
      // Browser monitoring must not cause another application error.
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const diagnostic = hydrationDiagnostic(event.reason, undefined, window.location.pathname, window.location.origin);
      Sentry.captureMessage('storefront.browser.unhandled_rejection', {
        level: 'error',
        fingerprint: ['storefront.browser.unhandled_rejection', diagnostic.errorName, diagnostic.routeGroup],
        tags: {errorName: diagnostic.errorName, reactErrorCode: diagnostic.reactErrorCode, routeGroup: diagnostic.routeGroup},
        contexts: {diagnostic: {scriptStack: diagnostic.scriptStack}},
      });
    } catch {
      // Browser monitoring must not cause another application error.
    }
  });
}
