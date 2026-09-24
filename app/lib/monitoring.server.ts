export type Monitor = {
  count(name: string, tags?: Record<string, string | number | boolean>): void;
  duration(name: string, milliseconds: number, tags?: Record<string, string | number | boolean>): void;
  failure(name: string, tags?: Record<string, string | number | boolean>, error?: unknown): void;
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

export function safeErrorTags(error: unknown): Record<string, string | number> {
  if (!(error instanceof Error)) return {errorName: 'UnknownError'};
  const errorName = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'AbortError', 'TimeoutError'].includes(error.name)
    ? error.name
    : 'OtherError';
  const status = error.message.match(/(?:\bstatus\s*[:=]?\s*|\()(4\d\d|5\d\d)\b/i)?.[1];
  return status ? {errorName, upstreamStatus: Number(status)} : {errorName};
}

export function safeErrorStack(error: unknown): string {
  if (!(error instanceof Error)) return 'unavailable';
  const frames = (error.stack || '').split('\n').flatMap((line) => {
    const match = line.match(/\bat ([A-Za-z_$][\w$.<>-]{0,79})?\s*\(?(?:[^\s()]*\/)?([A-Za-z0-9_.-]+\.(?:js|tsx?)):(\d{1,6}):(\d{1,6})\)?/);
    return match ? [`${match[1] || '<anonymous>'} ${match[2]}:${match[3]}:${match[4]}`] : [];
  }).slice(0, 8);
  return frames.join(' | ') || 'unavailable';
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
      monitor.failure('storefront.query.failure', {operation}, error);
      throw error;
    },
  );
}

export async function measureOptionalStorefront<T>(
  monitor: Monitor | null,
  operation: string,
  query: () => Promise<T>,
): Promise<T | null> {
  try {
    return await measureStorefront(monitor, operation, query);
  } catch {
    return null;
  }
}
