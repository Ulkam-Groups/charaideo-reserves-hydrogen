import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearShiprocketTokenForTests,
  getShiprocketDeliveryEstimate,
  ShiprocketConfigurationError,
} from '../app/lib/shiprocket.server.ts';

const env = {
  SHIPROCKET_API_EMAIL: 'shipping-api@example.com',
  SHIPROCKET_API_PASSWORD: 'test-password',
  SHIPROCKET_PICKUP_PINCODE: '785690',
  SHIPROCKET_DEFAULT_WEIGHT_KG: '0.5',
} as Env;

test('Shiprocket authenticates server-side and returns its recommended courier', async () => {
  clearShiprocketTokenForTests();
  const requests: Array<{url: URL; init?: RequestInit}> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({url, init});

    if (url.pathname.endsWith('/auth/login')) {
      return Response.json({token: 'a'.repeat(40)});
    }

    return Response.json({
      data: {
        recommended_courier_company_id: 20,
        available_courier_companies: [
          {
            courier_company_id: 10,
            courier_name: 'Fastest Courier',
            etd: '30 Sep 2026',
            estimated_delivery_days: '2',
          },
          {
            courier_company_id: 20,
            courier_name: 'Recommended Courier',
            etd: '01 Oct 2026',
            estimated_delivery_days: '3 Days',
          },
        ],
      },
    });
  }) as typeof fetch;

  const estimate = await getShiprocketDeliveryEstimate({
    env,
    destinationPincode: '560001',
    fetcher,
  });

  assert.deepEqual(estimate, {
    serviceable: true,
    courierName: 'Recommended Courier',
    estimatedDeliveryDate: '01 Oct 2026',
    estimatedDays: 3,
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    email: env.SHIPROCKET_API_EMAIL,
    password: env.SHIPROCKET_API_PASSWORD,
  });
  assert.equal(requests[1].url.searchParams.get('pickup_postcode'), '785690');
  assert.equal(requests[1].url.searchParams.get('delivery_postcode'), '560001');
  assert.equal(requests[1].url.searchParams.get('weight'), '0.5');
  assert.equal(requests[1].url.searchParams.get('cod'), '0');
  assert.equal(
    new Headers(requests[1].init?.headers).get('Authorization'),
    `Bearer ${'a'.repeat(40)}`,
  );
});

test('Shiprocket token is reused and an empty courier list is not serviceable', async () => {
  clearShiprocketTokenForTests();
  let authenticationCalls = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/login')) {
      authenticationCalls += 1;
      return Response.json({token: 'b'.repeat(40)});
    }
    return Response.json({data: {available_courier_companies: []}});
  }) as typeof fetch;

  const first = await getShiprocketDeliveryEstimate({
    env,
    destinationPincode: '700001',
    fetcher,
  });
  const second = await getShiprocketDeliveryEstimate({
    env,
    destinationPincode: '110001',
    fetcher,
  });

  assert.equal(authenticationCalls, 1);
  assert.deepEqual(first, {
    serviceable: false,
    courierName: null,
    estimatedDeliveryDate: null,
    estimatedDays: null,
  });
  assert.deepEqual(second, first);
});

test('a configured Shiprocket bearer token bypasses authentication', async () => {
  clearShiprocketTokenForTests();
  const token = 'manual-token-from-shiprocket';
  let authenticationCalls = 0;
  let authorization = '';
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/login')) authenticationCalls += 1;
    authorization = new Headers(init?.headers).get('Authorization') ?? '';
    return Response.json({
      data: {
        available_courier_companies: [
          {courier_name: 'Token Courier', estimated_delivery_days: 2},
        ],
      },
    });
  }) as typeof fetch;

  const estimate = await getShiprocketDeliveryEstimate({
    env: {...env, SHIPROCKET_API_TOKEN: token},
    destinationPincode: '560066',
    fetcher,
  });

  assert.equal(authenticationCalls, 0);
  assert.equal(authorization, `Bearer ${token}`);
  assert.equal(estimate.serviceable, true);
});

test('Shiprocket refreshes its token once after an unauthorized response', async () => {
  clearShiprocketTokenForTests();
  let authenticationCalls = 0;
  let serviceabilityCalls = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/login')) {
      authenticationCalls += 1;
      return Response.json({token: String(authenticationCalls).repeat(40)});
    }
    serviceabilityCalls += 1;
    if (serviceabilityCalls === 1) return new Response('', {status: 401});
    return Response.json({
      data: {
        available_courier_companies: [
          {courier_name: 'Delivery Partner', estimated_delivery_days: 4},
        ],
      },
    });
  }) as typeof fetch;

  const estimate = await getShiprocketDeliveryEstimate({
    env,
    destinationPincode: '400001',
    fetcher,
  });

  assert.equal(authenticationCalls, 2);
  assert.equal(serviceabilityCalls, 2);
  assert.equal(estimate.serviceable, true);
  assert.equal(estimate.estimatedDays, 4);
});

test('Shiprocket configuration and customer pincodes are validated before fetch', async () => {
  clearShiprocketTokenForTests();
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return Response.json({});
  }) as typeof fetch;

  await assert.rejects(
    getShiprocketDeliveryEstimate({
      env: {...env, SHIPROCKET_PICKUP_PINCODE: 'invalid'},
      destinationPincode: '560001',
      fetcher,
    }),
    ShiprocketConfigurationError,
  );
  await assert.rejects(
    getShiprocketDeliveryEstimate({
      env,
      destinationPincode: '56000',
      fetcher,
    }),
    /valid 6-digit pincode/,
  );
  assert.equal(calls, 0);
});
