/**
 * Rate-limit policy registry for storefront endpoints. Edit limits here.
 * `null` means the route has no application-level rate limit.
 *
 * Oxygen's Cache API is local to each data center and its writes are not atomic.
 * These limits reduce simple loops; use a durable atomic store for strict limits.
 * Endpoints with a non-null policy must call enforceApiRateLimit before their work.
 */
export const API_RATE_LIMITS = {
  '/api/waitlist': {
    limits: [
      {max: 3, windowMs: 60_000},
      {max: 6, windowMs: 86_400_000},
    ],
  },
  '/api/blend-checkout': null, // Retired: always 410.
  '/api/admin/teas': null, // Disabled: always 404.
  '/api/shipping-estimate': {
    limits: [
      {max: 20, windowMs: 60_000},
      {max: 300, windowMs: 86_400_000},
    ],
  },
  '/agent/buyer-claims': null, // Read-only Shopify chat proxy.
  '/cart': null, // Hydrogen cart actions; protected by form and session checks.
  '/cart/:lines': null, // Cart permalink.
  '/webhooks/orders-create': null, // Retired, signed no-op.
} as const;

export type ApiRateLimitRoute = keyof typeof API_RATE_LIMITS;

function reject(status: number, error: string, retryAfter?: number) {
  return Response.json(
    {error},
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(retryAfter ? {'Retry-After': String(retryAfter)} : {}),
      },
    },
  );
}

export async function enforceApiRateLimit(
  request: Request,
  cache: Pick<Cache, 'match' | 'put'>,
  route: ApiRateLimitRoute,
  now = Date.now(),
): Promise<Response | null> {
  const policy = API_RATE_LIMITS[route];
  if (!policy) return null;

  const buyerIp = request.headers.get('oxygen-buyer-ip');
  if (!buyerIp) return reject(503, 'Service temporarily unavailable');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(buyerIp));
  const identity = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const counters: Array<{
    key: Request;
    timestamps: number[];
    retryAfter: number;
    max: number;
    windowMs: number;
  }> = [];

  for (const {max, windowMs} of policy.limits) {
    const keyUrl = new URL(
      `/__api-rate-limit/${encodeURIComponent(route)}/${windowMs}/${identity}`,
      request.url,
    );
    // Oxygen only caches HTTPS keys, including when the storefront runs locally over HTTP.
    keyUrl.protocol = 'https:';
    const key = new Request(keyUrl);
    const previous = await cache.match(key);
    let stored: unknown = [];
    try {
      if (previous) stored = JSON.parse(await previous.text());
    } catch {
      stored = [];
    }
    const timestamps = Array.isArray(stored)
      ? stored
          .filter(
            (value): value is number =>
              typeof value === 'number' && value > now - windowMs && value <= now,
          )
          .sort((left, right) => left - right)
      : [];
    const retryAfter = timestamps.length
      ? Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1000))
      : Math.ceil(windowMs / 1000);
    counters.push({key, timestamps, retryAfter, max, windowMs});
  }

  const exceeded = counters.find(({timestamps, max}) => timestamps.length >= max);
  if (exceeded) {
    return reject(429, 'Too many requests. Please try again later.', exceeded.retryAfter);
  }

  for (const {key, timestamps, windowMs} of counters) {
    await cache.put(
      key,
      new Response(JSON.stringify([...timestamps, now]), {
        headers: {'Cache-Control': `public, max-age=${Math.ceil(windowMs / 1000)}`},
      }),
    );
  }
  return null;
}
