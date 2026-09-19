import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measureStorefront,
  monitoringEnabled,
  sentryIngestOrigin,
} from '../app/lib/monitoring.server.ts';
import {createMonitorIfEnabled} from '../app/lib/sentry-client.server.ts';
import {
  installMonitoringRecorder,
  prepareMonitoringSignals,
  recordFastrrLaunch,
  recordHydrationFailure,
} from '../app/lib/monitoring-signals.ts';

test('monitoring requires the exact enabled value', () => {
  assert.equal(monitoringEnabled('true'), true);
  assert.equal(monitoringEnabled('false'), false);
  assert.equal(monitoringEnabled('TRUE'), false);
  assert.equal(monitoringEnabled(undefined), false);
  assert.equal(
    createMonitorIfEnabled('false', 'https://public@o1.ingest.sentry.io/123'),
    null,
  );
});

test('browser signals are buffered only while enabled and cannot interrupt checkout', () => {
  const received: unknown[] = [];
  installMonitoringRecorder(null);
  recordFastrrLaunch('cart', 'missing');
  prepareMonitoringSignals();
  recordFastrrLaunch('product', 'threw');
  recordHydrationFailure();
  installMonitoringRecorder((signal) => received.push(signal));
  assert.deepEqual(received, [
    {kind: 'fastrr', source: 'product', result: 'threw'},
    {kind: 'hydration'},
  ]);
  installMonitoringRecorder(() => {
    throw new Error('monitoring unavailable');
  });
  assert.doesNotThrow(() => recordFastrrLaunch('cart', 'requested'));
  installMonitoringRecorder(null);
});

test('Sentry ingest accepts only HTTPS Sentry hosts', () => {
  assert.equal(
    sentryIngestOrigin('https://key@o1.ingest.sentry.io/123'),
    'https://o1.ingest.sentry.io',
  );
  assert.equal(sentryIngestOrigin('https://key@sentry.io.evil.test/123'), null);
  assert.equal(sentryIngestOrigin('http://key@o1.ingest.sentry.io/123'), null);
});

test('server metrics and failures send no storefront request data', async () => {
  const originalFetch = globalThis.fetch;
  const envelopes: string[] = [];
  globalThis.fetch = async (_input, init) => {
    envelopes.push(String(init?.body));
    return new Response('', {status: 200});
  };
  try {
    const monitor = createMonitorIfEnabled(
      'true',
      'https://public@o1.ingest.sentry.io/123',
    );
    assert.ok(monitor);
    monitor.count('storefront.request.count', {status: 429});
    monitor.duration('storefront.request.duration', 15, {status: 429});
    monitor.failure('judgeme.reviews.failure', {reason: 'quota'});
    await new Promise<void>((resolve) =>
      monitor.flush(async (pending) => {
        await pending;
        resolve();
      }),
    );
    assert.ok(envelopes.length > 0);
    assert.ok(envelopes.some((body) => body.includes('storefront.request.count')));
    assert.ok(envelopes.some((body) => body.includes('judgeme.reviews.failure')));
    assert.ok(envelopes.every((body) => !body.includes('api_token')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failed Sentry delivery does not reject the request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Sentry unavailable');
  };
  try {
    const monitor = createMonitorIfEnabled(
      'true',
      'https://public@o1.ingest.sentry.io/123',
    );
    assert.ok(monitor);
    assert.doesNotThrow(() => monitor.failure('storefront.http.failure'));
    await new Promise<void>((resolve) =>
      monitor.flush(async (pending) => {
        await pending;
        resolve();
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Storefront measurement preserves success and failure', async () => {
  const success = Promise.resolve(42);
  assert.equal(
    measureStorefront(null, 'catalog', () => success),
    success,
  );
  assert.equal(await success, 42);
  await assert.rejects(
    measureStorefront(null, 'catalog', async () => {
      throw new Error('upstream');
    }),
    /upstream/,
  );
});
