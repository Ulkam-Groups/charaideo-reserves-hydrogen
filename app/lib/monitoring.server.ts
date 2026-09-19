export type Monitor = {
  count(name: string, tags?: Record<string, string | number | boolean>): void;
  duration(name: string, milliseconds: number, tags?: Record<string, string | number | boolean>): void;
  failure(name: string, tags?: Record<string, string | number | boolean>): void;
  flush(waitUntil: (promise: Promise<unknown>) => void): void;
};

export function monitoringEnabled(value?: string) {
  return value === 'true';
}

export function sentryIngestOrigin(dsn?: string) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    return url.protocol === 'https:' && /(^|\.)sentry\.io$/.test(url.hostname)
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function measureStorefront<T>(
  monitor: Monitor | null,
  operation: string,
  query: () => Promise<T>,
): Promise<T> {
  if (!monitor) return query();
  const start = performance.now();
  return query().then(
    (result) => {
      monitor.duration('storefront.query.duration', performance.now() - start, {operation});
      return result;
    },
    (error) => {
      monitor.duration('storefront.query.duration', performance.now() - start, {operation});
      monitor.failure('storefront.query.failure', {operation});
      throw error;
    },
  );
}
