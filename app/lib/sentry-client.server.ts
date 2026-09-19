import {Scope, ServerRuntimeClient, createTransport, metrics} from '@sentry/core';
import {monitoringEnabled, sentryIngestOrigin, type Monitor} from './monitoring.server.ts';

type Tags = Record<string, string | number | boolean>;

export function createMonitor(dsn?: string, environment?: string): Monitor | null {
  if (!sentryIngestOrigin(dsn)) return null;

  const client = new ServerRuntimeClient({
    dsn,
    environment: environment?.trim() || 'production',
    integrations: [],
    stackParser: () => [],
    transport: (options) =>
      createTransport(options, async ({body}) => {
        const response = await fetch(options.url, {
          method: 'POST',
          headers: {'Content-Type': 'application/x-sentry-envelope'},
          body: typeof body === 'string' ? body : new TextDecoder().decode(body),
        });
        await response.body?.cancel();
        return {
          statusCode: response.status,
          headers: {
            'x-sentry-rate-limits': response.headers.get('x-sentry-rate-limits'),
            'retry-after': response.headers.get('retry-after'),
          },
        };
      }),
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeSend(event) {
      // Never send URLs, request bodies, customer data, or upstream error text.
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      delete event.extra;
      return event;
    },
  });
  const scope = new Scope();
  scope.setClient(client);

  return {
    count(name: string, tags: Tags = {}) {
      try {
        metrics.count(name, 1, {attributes: tags, scope});
      } catch {
        // Monitoring must not affect the storefront.
      }
    },
    duration(name: string, milliseconds: number, tags: Tags = {}) {
      try {
        metrics.distribution(name, milliseconds, {
          unit: 'millisecond',
          attributes: tags,
          scope,
        });
      } catch {
        // Monitoring must not affect the storefront.
      }
    },
    failure(name: string, tags: Tags = {}) {
      try {
        const eventScope = scope.clone();
        eventScope.setTags(tags);
        eventScope.captureMessage(name, 'error');
        metrics.count(name, 1, {attributes: tags, scope});
      } catch {
        // Monitoring must not affect the storefront.
      }
    },
    flush(waitUntil: (promise: Promise<unknown>) => void) {
      try {
        waitUntil(Promise.resolve(client.flush(1500)).catch(() => false).finally(() => client.dispose()));
      } catch {
        client.dispose();
      }
    },
  };
}

export function createMonitorIfEnabled(enabled: string | undefined, dsn?: string, environment?: string) {
  if (!monitoringEnabled(enabled)) return null;
  try {
    return createMonitor(dsn, environment);
  } catch {
    return null;
  }
}
