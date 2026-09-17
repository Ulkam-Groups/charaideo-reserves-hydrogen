/** Apply before reading or acting on a browser request backed by a session or cart cookie. */
export async function readProtectedForm(
  request: Request,
  {methods, maxBytes}: {methods: readonly string[]; maxBytes: number},
): Promise<FormData | Response> {
  const reject = (status: number, message: string) =>
    new Response(message, {
      status,
      headers: {'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8'},
    });

  if (!methods.includes(request.method)) return reject(405, 'Method not allowed');

  const targetOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const matches = (value: string) => {
    try {
      return new URL(value).origin === targetOrigin;
    } catch {
      return false;
    }
  };
  // Browsers send Origin for unsafe requests. Referer is a strict fallback for
  // clients that omit it; never allow a request with neither header.
  if (
    (!origin && !referer) ||
    (origin !== null && !matches(origin)) ||
    (referer !== null && !matches(referer)) ||
    (request.headers.has('Sec-Fetch-Site') &&
      request.headers.get('Sec-Fetch-Site') !== 'same-origin')
  ) {
    return reject(403, 'Cross-origin request rejected');
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    return reject(415, 'Unsupported content type');
  }

  const length = request.headers.get('Content-Length');
  if (length !== null) {
    if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
      return reject(400, 'Invalid content length');
    }
    if (Number(length) > maxBytes) return reject(413, 'Request body too large');
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return reject(413, 'Request body too large');
        }
        chunks.push(value);
      }
    } catch {
      return reject(400, 'Invalid request body');
    } finally {
      reader.releaseLock();
    }
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const params = new URLSearchParams(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    const form = new FormData();
    for (const [key, value] of params) form.append(key, value);
    return form;
  } catch {
    return reject(400, 'Invalid request body');
  }
}
