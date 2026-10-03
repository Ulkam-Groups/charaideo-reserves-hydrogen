import type {Route} from './+types/shopify-agent-api.$';

const AGENT_ORIGIN = 'https://storefront-agent-server.shopify.ai';
const LOCAL_PREFIX = '/shopify-agent-api';
const DEFAULT_CHAT_SHOP = 'charaideoreserves.myshopify.com';
const MAX_REQUEST_BYTES = 256 * 1024;
const SAFE_ID = '[A-Za-z0-9_-]{1,200}';

const ALLOWED_ROUTES: ReadonlyArray<{
  methods: ReadonlySet<string>;
  pattern: RegExp;
}> = [
  {methods: new Set(['POST']), pattern: /^\/api\/buyer_context\/warm$/},
  {
    methods: new Set(['GET', 'POST']),
    pattern: /^\/api\/store\/[a-z0-9][a-z0-9-]*\/conversations$/,
  },
  {
    methods: new Set(['POST']),
    pattern: /^\/api\/store\/[a-z0-9][a-z0-9-]*\/conversations\/claim$/,
  },
  {
    methods: new Set(['GET', 'DELETE']),
    pattern: new RegExp(
      `^/api/store/[a-z0-9][a-z0-9-]*/conversations/${SAFE_ID}$`,
    ),
  },
  {
    methods: new Set(['DELETE']),
    pattern: new RegExp(
      `^/api/store/[a-z0-9][a-z0-9-]*/conversations/${SAFE_ID}/stream$`,
    ),
  },
  {
    methods: new Set(['GET']),
    pattern: /^\/api\/store\/[a-z0-9][a-z0-9-]*\/empty_state$/,
  },
  {
    methods: new Set(['POST']),
    pattern: /^\/api\/store\/[a-z0-9][a-z0-9-]*\/zero_turn_suggestions$/,
  },
  {
    methods: new Set(['POST']),
    pattern: /^\/api\/store\/[a-z0-9][a-z0-9-]*\/messages$/,
  },
  {
    methods: new Set(['POST']),
    pattern: new RegExp(
      `^/api/store/[a-z0-9][a-z0-9-]*/messages/${SAFE_ID}/feedback$`,
    ),
  },
];

const BLOCKED_REQUEST_HEADERS = new Set([
  'authorization',
  'connection',
  'content-length',
  'cookie',
  'forwarded',
  'host',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-real-ip',
]);

const BLOCKED_REQUEST_HEADER_PREFIXES = [
  'cf-',
  'fly-',
  'proxy-',
  'true-client-',
  'x-forwarded-',
] as const;

const RESPONSE_HEADER_ALLOWLIST = [
  'content-type',
  'retry-after',
  'x-request-id',
] as const;

export function loader(args: Route.LoaderArgs) {
  return proxyAgentRequest(
    args.request,
    args.context.env.PUBLIC_SHOPIFY_CHAT_SHOP,
  );
}

export function action(args: Route.ActionArgs) {
  return proxyAgentRequest(
    args.request,
    args.context.env.PUBLIC_SHOPIFY_CHAT_SHOP,
  );
}

async function proxyAgentRequest(
  request: Request,
  configuredChatShop: string | undefined,
) {
  const requestUrl = new URL(request.url);
  const upstreamPath = requestUrl.pathname.slice(LOCAL_PREFIX.length);
  const storeHandle = getStoreHandle(configuredChatShop ?? DEFAULT_CHAT_SHOP);

  if (!storeHandle) {
    return privateResponse('Shopify store domain is unavailable', 503);
  }
  if (!isAllowedRequest(request.method, upstreamPath, storeHandle)) {
    return privateResponse('Unsupported Shopify agent API request', 404);
  }
  if (requestUrl.href.length > 2048 || !hasAllowedQuery(upstreamPath, requestUrl)) {
    return privateResponse('Invalid Shopify agent API query', 400);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return privateResponse('Shopify agent API request is too large', 413);
  }

  const body = await readBoundedBody(request);
  if (body === null) {
    return privateResponse('Shopify agent API request is too large', 413);
  }

  const upstreamUrl = new URL(`${upstreamPath}${requestUrl.search}`, AGENT_ORIGIN);
  const headers = sanitizeRequestHeaders(request.headers);
  headers.set('origin', AGENT_ORIGIN);
  headers.set('referer', `${AGENT_ORIGIN}/`);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: request.signal,
    });
  } catch {
    return privateResponse('Shopify agent API is temporarily unavailable', 502);
  }

  const responseHeaders = pickHeaders(
    upstream.headers,
    RESPONSE_HEADER_ALLOWLIST,
  );
  responseHeaders.set('Cache-Control', 'private, no-store');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  let responseBody: BodyInit | null = upstream.body;
  if (!upstream.headers.get('content-type')?.includes('text/event-stream')) {
    try {
      responseBody = await upstream.arrayBuffer();
    } catch {
      return privateResponse('Shopify agent API response was interrupted', 502);
    }
  }

  return new Response(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

function getStoreHandle(storeDomain: string | undefined) {
  const normalizedDomain = storeDomain
    ?.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const match = normalizedDomain?.match(
    /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

function isAllowedRequest(method: string, path: string, storeHandle: string) {
  const route = ALLOWED_ROUTES.find(({pattern}) => pattern.test(path));
  if (!route?.methods.has(method)) return false;

  const pathStoreHandle = path.match(/^\/api\/store\/([^/]+)\//)?.[1];
  return !pathStoreHandle || pathStoreHandle.toLowerCase() === storeHandle;
}

function hasAllowedQuery(path: string, url: URL) {
  const allowedNames = path.endsWith('/conversations')
    ? new Set(['scenarios[]'])
    : path.endsWith('/stream')
      ? new Set(['request_id'])
      : /\/conversations\/[A-Za-z0-9_-]{1,200}$/.test(path)
        ? new Set(['include_feedback_metadata'])
        : new Set<string>();

  return [...url.searchParams.keys()].every((name) => allowedNames.has(name));
}

async function readBoundedBody(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const body = await request.arrayBuffer();
  return body.byteLength <= MAX_REQUEST_BYTES ? body : null;
}

function pickHeaders(
  source: Headers,
  allowedNames: readonly string[],
) {
  const headers = new Headers();
  for (const name of allowedNames) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function sanitizeRequestHeaders(source: Headers) {
  const headers = new Headers();
  for (const [name, value] of source) {
    const normalizedName = name.toLowerCase();
    if (
      BLOCKED_REQUEST_HEADERS.has(normalizedName) ||
      BLOCKED_REQUEST_HEADER_PREFIXES.some((prefix) =>
        normalizedName.startsWith(prefix),
      )
    ) {
      continue;
    }
    headers.set(name, value);
  }
  return headers;
}

function privateResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
