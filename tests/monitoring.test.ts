import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measureOptionalStorefront,
  measureStorefront,
  monitoringEnabled,
  safeErrorStack,
  safeErrorTags,
  sentryIngestOrigin,
} from '../app/lib/monitoring.server.ts';
import {createMonitorIfEnabled} from '../app/lib/sentry-client.server.ts';
import {
  installMonitoringRecorder,
  prepareMonitoringSignals,
  recordFastrrLaunch,
  recordHydrationFailure,
  hydrationDiagnostic,
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
  recordHydrationFailure(
    new Error('Minified React error #418; visit https://react.dev/errors/418'),
    '\n    at html\n    at App (https://shop.example/products/private?email=secret@example.com)',
    '/products/private',
  );
  installMonitoringRecorder((signal) => received.push(signal));
  assert.deepEqual(received[0], {kind: 'fastrr', source: 'product', result: 'threw'});
  const hydration = received[1] as {
    kind: string;
    diagnostic: {
      reactErrorCode: string;
      errorName: string;
      routeGroup: string;
      componentStack: string;
      scriptStack: string;
    };
  };
  assert.equal(hydration.kind, 'hydration');
  assert.equal(hydration.diagnostic.reactErrorCode, '418');
  assert.equal(hydration.diagnostic.errorName, 'Error');
  assert.equal(hydration.diagnostic.routeGroup, 'products');
  assert.equal(hydration.diagnostic.componentStack, 'html > App');
  assert.equal(hydration.diagnostic.scriptStack, 'unavailable');
  installMonitoringRecorder(() => {
    throw new Error('monitoring unavailable');
  });
  assert.doesNotThrow(() => recordFastrrLaunch('cart', 'requested'));
  installMonitoringRecorder(null);
});

test('hydration diagnostics include useful frames without URL, query, or customer text', () => {
  const error = new Error(
    'Minified React error #423; visit https://reactjs.org/docs/error-decoder.html?invariant=423&customer=private',
  );
  error.stack =
    'Error: private\n    at hydrate (https://shop.example/assets/entry.client-abc.js:28:15415?customer=private)\n    at custom (https://shop.example/products/private:4:5)';
  const diagnostic = hydrationDiagnostic(
    error,
    '\n    at html (https://shop.example/products/private?email=secret@example.com)\n    at CartAside (https://shop.example/cart?token=private)',
    '/products/customer-private',
    'https://shop.example',
  );
  assert.equal(diagnostic.reactErrorCode, '423');
  assert.equal(diagnostic.routeGroup, 'products');
  assert.equal(diagnostic.componentStack, 'html > CartAside');
  assert.match(diagnostic.scriptStack, /entry\.client-abc\.js:28:15415/);
  assert.deepEqual(diagnostic.frames, [
    {
      filename: 'https://shop.example/assets/entry.client-abc.js',
      abs_path: 'https://shop.example/assets/entry.client-abc.js',
      function: 'hydrate',
      lineno: 28,
      colno: 15415,
      in_app: true,
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(diagnostic),
    /private|secret@example\.com|customer=/,
  );
});

test('hydration recovery is suppressed after the first mismatch on a page', () => {
  const received: unknown[] = [];
  installMonitoringRecorder(null);
  prepareMonitoringSignals();
  installMonitoringRecorder((signal) => received.push(signal));
  recordHydrationFailure(
    new Error('https://react.dev/errors/418'),
    '\n    at App',
    '/',
    'https://shop.example',
  );
  recordHydrationFailure(
    new Error('https://react.dev/errors/423'),
    undefined,
    '/',
    'https://shop.example',
  );
  assert.equal(received.length, 1);
  assert.match(JSON.stringify(received[0]), /"reactErrorCode":"418"/);
  installMonitoringRecorder(null);
});

test('structured frames reject third-party scripts and URLs with private paths', () => {
  const error = new Error('private');
  error.stack =
    'Error: private\n    at external (https://other.example/assets/remote.js:1:2)\n    at path (https://shop.example/account/private.js:3:4)';
  const diagnostic = hydrationDiagnostic(
    error,
    undefined,
    '/account/customer',
    'https://shop.example',
  );
  assert.deepEqual(diagnostic.frames, []);
  assert.doesNotMatch(JSON.stringify(diagnostic), /customer|remote\.js|private\.js/);
});

test('Sentry ingest accepts only HTTPS Sentry hosts', () => {
  assert.equal(
    sentryIngestOrigin('https://key@o1.ingest.sentry.io/123'),
    'https://o1.ingest.sentry.io',
  );
  assert.equal(sentryIngestOrigin('https://key@sentry.io.evil.test/123'), null);
  assert.equal(sentryIngestOrigin('http://key@o1.ingest.sentry.io/123'), null);
});

test('server error tags never include upstream error text', () => {
  const tags = safeErrorTags(
    new Error('Judge.me request failed (429) token=secret-private'),
  );
  assert.deepEqual(tags, {errorName: 'Error', upstreamStatus: 429});
  assert.doesNotMatch(JSON.stringify(tags), /secret-private/);
});

test('server error frames omit paths and error messages', () => {
  const error = new Error('private customer details');
  error.stack =
    'Error: private customer details\n    at loader (C:/private/customer/app/routes/account.tsx:24:12)\n    at secret (https://shop.example/orders/customer?id=private:4:5)';
  assert.equal(safeErrorStack(error), 'loader account.tsx:24:12');
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
      'production',
      '11111111-2222-4333-8444-555555555555',
    );
    assert.ok(monitor);
    monitor.count('storefront.request.count', {status: 429});
    monitor.duration('storefront.request.duration', 15, {status: 429});
    monitor.failure(
      'judgeme.reviews.failure',
      {reason: 'quota'},
      new Error('Judge.me request failed (429) api_token=secret-private'),
    );
    await new Promise<void>((resolve) =>
      monitor.flush(async (pending) => {
        await pending;
        resolve();
      }),
    );
    assert.ok(envelopes.length > 0);
    assert.ok(envelopes.some((body) => body.includes('storefront.request.count')));
    assert.ok(envelopes.some((body) => body.includes('judgeme.reviews.failure')));
    assert.ok(
      envelopes.some((body) => body.includes('11111111-2222-4333-8444-555555555555')),
    );
    assert.ok(envelopes.some((body) => body.includes('upstreamStatus')));
    assert.ok(
      envelopes.every(
        (body) => !body.includes('api_token') && !body.includes('secret-private'),
      ),
    );
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

test('optional Storefront measurement contains upstream failure', async () => {
  assert.equal(await measureOptionalStorefront(null, 'header', async () => 42), 42);
  assert.equal(
    await measureOptionalStorefront(null, 'header', async () => {
      throw new Error('upstream');
    }),
    null,
  );
});
