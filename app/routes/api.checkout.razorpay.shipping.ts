import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {
  buildRazorpayShippingResponse,
  parseRazorpayShippingAddresses,
} from '~/lib/checkout/providers/razorpay/razorpay-shipping.server';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': 'no-store'},
  });
}

function respond(value: unknown, context: LoaderFunctionArgs['context']) {
  if (resolveCheckoutProvider(context.env.CHECKOUT_PROVIDER) !== 'razorpay') {
    return json({error: 'Checkout provider is unavailable'}, 404);
  }
  const addresses = parseRazorpayShippingAddresses(value);
  if (!addresses) return json({error: 'Invalid shipping request'}, 400);

  try {
    return json(buildRazorpayShippingResponse(addresses, context.env));
  } catch {
    return json({error: 'Shipping is not configured'}, 503);
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new Error('Request is too large');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const encoded = url.searchParams.get('addresses');
  if (encoded) {
    try {
      return respond(JSON.parse(encoded), context);
    } catch {
      return json({error: 'Invalid shipping request'}, 400);
    }
  }

  if (request.body) {
    try {
      const body = (await readJsonBody(request)) as {addresses?: unknown};
      return respond(body.addresses, context);
    } catch {
      return json({error: 'Invalid shipping request'}, 400);
    }
  }

  return respond(
    [
      {
        id: url.searchParams.get('id') ?? '',
        zipcode: url.searchParams.get('zipcode') ?? '',
        state_code: url.searchParams.get('state_code') ?? undefined,
        country: url.searchParams.get('country') ?? '',
      },
    ],
    context,
  );
}

export async function action({request, context}: ActionFunctionArgs) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    return json({error: 'Invalid shipping request'}, 400);
  }

  try {
    const body = (await readJsonBody(request)) as {
      addresses?: unknown;
    };
    return respond(body.addresses, context);
  } catch {
    return json({error: 'Invalid shipping request'}, 400);
  }
}
