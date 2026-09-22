const MAX_BODY_BYTES = 512;
const noStore = {'Cache-Control': 'no-store'};

function reject(status: number, error: string, retryAfter?: number) {
  return Response.json(
    {error},
    {
      status,
      headers: {
        ...noStore,
        ...(retryAfter ? {'Retry-After': String(retryAfter)} : {}),
      },
    },
  );
}

export async function readWaitlistRequest(
  request: Request,
): Promise<{email: string; consent: true} | Response> {
  if (request.method !== 'POST') return reject(405, 'Method not allowed');

  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const sameOrigin = (value: string) => {
    try {
      return new URL(value).origin === expectedOrigin;
    } catch {
      return false;
    }
  };
  if (
    (!origin && !referer) ||
    (origin !== null && !sameOrigin(origin)) ||
    (referer !== null && !sameOrigin(referer)) ||
    (request.headers.has('Sec-Fetch-Site') &&
      request.headers.get('Sec-Fetch-Site') !== 'same-origin')
  ) {
    return reject(403, 'Request origin rejected');
  }

  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get('Content-Type') ?? '',
    )
  ) {
    return reject(415, 'JSON required');
  }
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) return reject(400, 'Invalid content length');
    if (Number(declaredLength) > MAX_BODY_BYTES)
      return reject(413, 'Request body too large');
  }

  let raw: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reject(400, 'Invalid JSON');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return reject(413, 'Request body too large');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    raw = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    return reject(400, 'Invalid JSON');
  }

  let body: {email?: unknown; consent?: unknown};
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(400, 'Invalid JSON');
  }
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reject(400, 'Valid email required');
  }
  if (body?.consent !== true) return reject(400, 'Email consent required');
  return {email, consent: true};
}
