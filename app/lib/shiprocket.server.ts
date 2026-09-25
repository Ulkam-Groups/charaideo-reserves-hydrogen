const SHIPROCKET_AUTH_URL =
  'https://apiv2.shiprocket.in/v1/external/auth/login';
const SHIPROCKET_SERVICEABILITY_URL =
  'https://apiv2.shiprocket.in/v1/external/courier/serviceability/';
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

type Fetcher = typeof fetch;

type ShiprocketConfig = {
  pickupPincode: string;
  defaultWeightKg: number;
} & (
  | {apiToken: string; email: null; password: null}
  | {apiToken: null; email: string; password: string}
);

type ShiprocketCourier = Record<string, unknown> & {
  courier_company_id?: number | string;
  courier_name?: string;
  etd?: string;
  estimated_delivery_days?: number | string;
};

type ShiprocketServiceabilityResponse = {
  data?: {
    available_courier_companies?: unknown;
    recommended_courier_company_id?: number | string | null;
    shiprocket_recommended_courier_id?: number | string | null;
  };
};

export type ShiprocketDeliveryEstimate = {
  serviceable: boolean;
  courierName: string | null;
  estimatedDeliveryDate: string | null;
  estimatedDays: number | null;
};

export class ShiprocketConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiprocketConfigurationError';
  }
}

export class ShiprocketRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ShiprocketRequestError';
    this.status = status;
  }
}

let tokenCache: {token: string; expiresAt: number; email: string} | null = null;
let tokenRequest: Promise<string> | null = null;

export function shiprocketIntegrationReady(env: Env) {
  return Boolean(
    (env.SHIPROCKET_API_TOKEN?.trim() ||
      (env.SHIPROCKET_API_EMAIL?.trim() &&
        env.SHIPROCKET_API_PASSWORD?.trim())) &&
      /^\d{6}$/.test(env.SHIPROCKET_PICKUP_PINCODE?.trim() ?? ''),
  );
}

export async function getShiprocketDeliveryEstimate({
  env,
  destinationPincode,
  fetcher = fetch,
}: {
  env: Env;
  destinationPincode: string;
  fetcher?: Fetcher;
}): Promise<ShiprocketDeliveryEstimate> {
  if (!/^\d{6}$/.test(destinationPincode)) {
    throw new ShiprocketRequestError('A valid 6-digit pincode is required', 400);
  }

  const config = readConfig(env);
  const token = await getToken(config, fetcher);
  let response = await requestServiceability(
    config,
    destinationPincode,
    token,
    fetcher,
  );

  if (response.status === 401 && !config.apiToken) {
    clearToken();
    const refreshedToken = await getToken(config, fetcher);
    response = await requestServiceability(
      config,
      destinationPincode,
      refreshedToken,
      fetcher,
    );
  }

  if (!response.ok) {
    throw new ShiprocketRequestError(
      'Shiprocket serviceability request failed',
      response.status,
    );
  }

  const payload = (await readJson(response)) as ShiprocketServiceabilityResponse;
  const couriers = normaliseCouriers(payload.data?.available_courier_companies);

  if (couriers.length === 0) {
    return {
      serviceable: false,
      courierName: null,
      estimatedDeliveryDate: null,
      estimatedDays: null,
    };
  }

  const recommendedId =
    payload.data?.recommended_courier_company_id ??
    payload.data?.shiprocket_recommended_courier_id;
  const courier = selectCourier(couriers, recommendedId);

  return {
    serviceable: true,
    courierName: cleanText(courier.courier_name),
    estimatedDeliveryDate: cleanText(courier.etd),
    estimatedDays: parseDays(courier.estimated_delivery_days),
  };
}

function readConfig(env: Env): ShiprocketConfig {
  const apiToken = env.SHIPROCKET_API_TOKEN?.trim() || null;
  const email = env.SHIPROCKET_API_EMAIL?.trim();
  const password = env.SHIPROCKET_API_PASSWORD?.trim();
  const pickupPincode = env.SHIPROCKET_PICKUP_PINCODE?.trim();
  const weightText = env.SHIPROCKET_DEFAULT_WEIGHT_KG?.trim() || '0.5';
  const defaultWeightKg = Number(weightText);

  if (!apiToken && (!email || !password)) {
    throw new ShiprocketConfigurationError(
      'A Shiprocket API token or API user credentials must be configured',
    );
  }
  if (!pickupPincode || !/^\d{6}$/.test(pickupPincode)) {
    throw new ShiprocketConfigurationError(
      'SHIPROCKET_PICKUP_PINCODE must be a 6-digit pincode',
    );
  }
  if (!Number.isFinite(defaultWeightKg) || defaultWeightKg <= 0) {
    throw new ShiprocketConfigurationError(
      'SHIPROCKET_DEFAULT_WEIGHT_KG must be greater than zero',
    );
  }

  return apiToken
    ? {apiToken, email: null, password: null, pickupPincode, defaultWeightKg}
    : {
        apiToken: null,
        email: email!,
        password: password!,
        pickupPincode,
        defaultWeightKg,
      };
}

async function getToken(config: ShiprocketConfig, fetcher: Fetcher) {
  if (config.apiToken) return config.apiToken;

  if (
    tokenCache &&
    tokenCache.email === config.email &&
    tokenCache.expiresAt > Date.now()
  ) {
    return tokenCache.token;
  }

  if (!tokenRequest) {
    tokenRequest = authenticate(config, fetcher).finally(() => {
      tokenRequest = null;
    });
  }

  return tokenRequest;
}

async function authenticate(config: ShiprocketConfig, fetcher: Fetcher) {
  if (config.apiToken) return config.apiToken;

  const response = await fetchWithTimeout(
    fetcher,
    SHIPROCKET_AUTH_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({email: config.email, password: config.password}),
    },
  );

  if (!response.ok) {
    throw new ShiprocketRequestError(
      response.status === 401 || response.status === 422
        ? 'Shiprocket rejected the API credentials'
        : 'Shiprocket authentication failed',
      response.status,
    );
  }

  const payload = (await readJson(response)) as {token?: unknown};
  if (typeof payload.token !== 'string' || payload.token.length < 20) {
    throw new ShiprocketRequestError(
      'Shiprocket authentication returned an invalid token',
    );
  }

  tokenCache = {
    token: payload.token,
    email: config.email!,
    // Shiprocket documents a ten-day token lifetime. Refresh a day early.
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return payload.token;
}

function requestServiceability(
  config: ShiprocketConfig,
  destinationPincode: string,
  token: string,
  fetcher: Fetcher,
) {
  const url = new URL(SHIPROCKET_SERVICEABILITY_URL);
  url.searchParams.set('pickup_postcode', config.pickupPincode);
  url.searchParams.set('delivery_postcode', destinationPincode);
  url.searchParams.set('weight', String(config.defaultWeightKg));
  url.searchParams.set('cod', '0');

  return fetchWithTimeout(fetcher, url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(input, {...init, signal: controller.signal});
  } catch (error) {
    throw new ShiprocketRequestError(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Shiprocket request timed out'
        : 'Shiprocket is temporarily unavailable',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ShiprocketRequestError(
      'Shiprocket returned an invalid response',
      response.status || 502,
    );
  }
}

function normaliseCouriers(value: unknown): ShiprocketCourier[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (courier): courier is ShiprocketCourier =>
      Boolean(courier) && typeof courier === 'object',
  );
}

function selectCourier(
  couriers: ShiprocketCourier[],
  recommendedId: number | string | null | undefined,
) {
  const recommended = couriers.find(
    (courier) =>
      recommendedId != null &&
      String(courier.courier_company_id) === String(recommendedId),
  );
  if (recommended) return recommended;

  return [...couriers].sort((left, right) => {
    const leftDays = parseDays(left.estimated_delivery_days) ?? Infinity;
    const rightDays = parseDays(right.estimated_delivery_days) ?? Infinity;
    return leftDays - rightDays;
  })[0];
}

function parseDays(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const days = Number(match[0]);
  return Number.isSafeInteger(days) && days >= 0 ? days : null;
}

function cleanText(value: unknown) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, 100) : null;
}

function clearToken() {
  tokenCache = null;
}

export function clearShiprocketTokenForTests() {
  clearToken();
  tokenRequest = null;
}
