import type {LoaderFunctionArgs} from 'react-router';
import {enforceApiRateLimit} from '~/lib/api-rate-limit.server';
import {
  getShiprocketDeliveryEstimate,
  ShiprocketConfigurationError,
  ShiprocketRequestError,
} from '~/lib/shiprocket.server';

function json(body: unknown, status = 200, cacheControl = 'no-store') {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': cacheControl},
  });
}

export async function loader({request, context}: LoaderFunctionArgs) {
  if (request.headers.has('oxygen-buyer-ip')) {
    const limited = await enforceApiRateLimit(
      request,
      context.reviewsCache,
      '/api/shipping-estimate',
    );
    if (limited) return limited;
  }

  const pincode = new URL(request.url).searchParams.get('pincode')?.trim();
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return json({error: 'Enter a valid 6-digit pincode'}, 400);
  }

  try {
    const estimate = await getShiprocketDeliveryEstimate({
      env: context.env,
      destinationPincode: pincode,
    });
    return json(
      estimate,
      200,
      'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
    );
  } catch (error) {
    if (error instanceof ShiprocketConfigurationError) {
      context.monitor?.failure('shiprocket.configuration.failure');
      return json({error: 'Delivery estimates are not configured yet'}, 503);
    }

    context.monitor?.failure('shiprocket.serviceability.failure', {
      status: error instanceof ShiprocketRequestError ? error.status : 502,
    });
    return json(
      {error: 'Delivery estimate is temporarily unavailable. Please try again.'},
      502,
    );
  }
}
