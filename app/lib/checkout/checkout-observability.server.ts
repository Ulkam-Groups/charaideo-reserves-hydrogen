import type {Monitor} from '../monitoring.server.ts';
import {
  safeMonitorCount,
  safeMonitorFailure,
  safeRequestId,
} from '../monitoring.server.ts';

type CheckoutLog = {
  level: 'info' | 'warn' | 'error';
  scope: string;
  stage: string;
  requestId: string;
  code?: string;
  event?: string;
  outcome?: string;
  correlation?: string;
  status?: number;
};

export function checkoutRequestId(
  request: Request,
  context: {requestId?: unknown},
) {
  return safeRequestId(
    typeof context.requestId === 'string'
      ? context.requestId
      : request.headers.get('x-request-id'),
  );
}

export function checkoutJson(
  body: unknown,
  status: number,
  requestId: string,
) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
    },
  });
}

export function checkoutResponse(
  body: BodyInit | null,
  status: number,
  requestId: string,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('X-Request-Id', requestId);
  return new Response(body, {status, headers: responseHeaders});
}

export async function checkoutCorrelation(value?: string) {
  if (!value || !/^order_[A-Za-z0-9]+$/.test(value)) return 'unavailable';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest).slice(0, 6), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function checkoutCount(
  monitor: Monitor | null | undefined,
  name: string,
  requestId: string,
  tags: Record<string, string | number | boolean> = {},
) {
  safeMonitorCount(monitor, name, {...tags, requestId});
}

export function checkoutFailure(
  monitor: Monitor | null | undefined,
  name: string,
  requestId: string,
  tags: Record<string, string | number | boolean>,
  error?: unknown,
) {
  safeMonitorFailure(monitor, name, {...tags, requestId}, error);
}

export function checkoutLog(entry: CheckoutLog) {
  const serialized = JSON.stringify(entry);
  if (entry.level === 'error') console.error(serialized);
  else if (entry.level === 'warn') console.warn(serialized);
  else console.info(serialized);
}
