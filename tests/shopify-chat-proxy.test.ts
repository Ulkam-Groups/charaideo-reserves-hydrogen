import assert from 'node:assert/strict';
import test from 'node:test';
import {
  action as agentAction,
  loader as agentLoader,
} from '../app/routes/shopify-agent-api.$.ts';
import {loader as assetLoader} from '../app/routes/shopify-chat-assets.$.ts';

const context = {
  env: {
    PUBLIC_STORE_DOMAIN: 'f5a7fq-re.myshopify.com',
    PUBLIC_SHOPIFY_CHAT_SHOP: 'charaideoreserves.myshopify.com',
  },
};

test('Shopify agent proxy forwards only required headers', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl: URL | undefined;
  let forwardedHeaders: Headers | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = new URL(String(input));
    forwardedHeaders = new Headers(init?.headers);
    return new Response('{}', {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'upstream_session=private',
        'X-Request-Id': 'safe-request-id',
      },
    });
  };

  try {
    const request = new Request(
      'https://store.example/shopify-agent-api/api/store/charaideoreserves/empty_state',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer private',
          Cookie: 'storefront_session=private',
          'Shopify-Runtime-Contract': 'required-value',
          'X-Buyer-Claims-Token': 'claims-token',
          'X-Forwarded-For': '203.0.113.1',
        },
      },
    );
    const response = await agentLoader({request, context} as any);

    assert.equal(
      requestedUrl?.href,
      'https://storefront-agent-server.shopify.ai/api/store/charaideoreserves/empty_state',
    );
    assert.equal(forwardedHeaders?.get('Accept'), 'application/json');
    assert.equal(forwardedHeaders?.get('X-Buyer-Claims-Token'), 'claims-token');
    assert.equal(forwardedHeaders?.get('Shopify-Runtime-Contract'), 'required-value');
    assert.equal(forwardedHeaders?.has('Authorization'), false);
    assert.equal(forwardedHeaders?.has('Cookie'), false);
    assert.equal(forwardedHeaders?.has('X-Forwarded-For'), false);
    assert.equal(response.headers.has('Set-Cookie'), false);
    assert.equal(response.headers.get('X-Request-Id'), 'safe-request-id');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Shopify agent proxy accepts the canonical buyer-claims store handle', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl: URL | undefined;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response('{}', {
      headers: {'Content-Type': 'application/json'},
    });
  };

  try {
    const response = await agentLoader({
      request: new Request(
        'https://store.example/shopify-agent-api/api/store/f5a7fq-re/empty_state',
      ),
      context,
    } as any);

    assert.equal(response.status, 200);
    assert.equal(
      requestedUrl?.href,
      'https://storefront-agent-server.shopify.ai/api/store/f5a7fq-re/empty_state',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Shopify agent proxy rejects other stores, paths, methods, and queries', async () => {
  const cases = [
    new Request(
      'https://store.example/shopify-agent-api/api/store/another-store/empty_state',
    ),
    new Request(
      'https://store.example/shopify-agent-api/api/store/charaideoreserves/admin',
    ),
    new Request(
      'https://store.example/shopify-agent-api/api/store/charaideoreserves/empty_state',
      {method: 'POST'},
    ),
    new Request(
      'https://store.example/shopify-agent-api/api/store/charaideoreserves/empty_state?target=https://example.com',
    ),
  ];

  for (const request of cases) {
    const response =
      request.method === 'GET'
        ? await agentLoader({request, context} as any)
        : await agentAction({request, context} as any);
    assert.ok(response.status === 400 || response.status === 404);
  }
});

test('Shopify agent proxy rejects oversized bodies', async () => {
  const request = new Request(
    'https://store.example/shopify-agent-api/api/store/charaideoreserves/messages',
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: 'x'.repeat(256 * 1024 + 1),
    },
  );
  const response = await agentAction({request, context} as any);
  assert.equal(response.status, 413);
});

test('Shopify chat asset proxy exposes approved chat module paths only', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response('export {};', {
      headers: {'Content-Type': 'application/javascript'},
    });
  };

  try {
    const paths = [
      'agent-iframe.js',
      'agent-iframe/observe-logger-impl-CvnPPqr9.js',
      'agent-iframe/agent-conversation-DLg-iwnG.js',
      'chat/runtime-ABC123.js',
    ];
    for (const path of paths) {
      const response = await assetLoader({
        request: new Request(`https://store.example/shopify-chat-assets/${path}`),
      } as any);

      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('Content-Type'),
        'application/javascript; charset=utf-8',
      );
    }
    assert.deepEqual(
      requestedUrls,
      paths.map((path) => `https://cdn.shopify.com/storefront/web-components/${path}`),
    );

    const response = await assetLoader({
      request: new Request(
        'https://store.example/shopify-chat-assets/agent-iframe/not-allowed.txt',
      ),
    } as any);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Shopify agent runtime trusts its same-origin proxied iframe shell', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      'function zt(e=window.location.href){const t=dt(e);if(t)return t;return new URL(e).hostname.endsWith(".shop.dev")?It:Ot}const next=1;',
      {headers: {'Content-Type': 'application/javascript'}},
    );

  try {
    const response = await assetLoader({
      request: new Request(
        'https://store.example/shopify-chat-assets/chat/agent-runtime-ABC123.js',
      ),
    } as any);
    const script = await response.text();

    assert.equal(response.status, 200);
    assert.match(script, /function zt\(\)\s*\{\s*return window\.location\.origin;\s*\}/);
    assert.doesNotMatch(script, /\.shop\.dev/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('claims bootstrap uses the buyer-token store handle for messaging history', async () => {
  const response = await assetLoader({
    request: new Request('https://store.example/shopify-chat-assets/claims-bootstrap.js'),
    context,
  } as any);
  const script = await response.text();

  assert.equal(response.status, 200);
  assert.match(script, /buyerStoreHandle="f5a7fq-re"/);
  assert.match(script, /url\.searchParams\.set\('store_handle',buyerStoreHandle\)/);
  assert.match(script, /url\.origin===window\.location\.origin&&isAgentApiPath/);
  assert.match(
    script,
    /url\.pathname\.replace\(\/\^\\\/api\\\/store\\\/\[\^\/\]\+\\\/\//,
  );
});
