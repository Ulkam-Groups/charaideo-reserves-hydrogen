import type {Route} from './+types/api.product-reviews';
import {getJudgeMeProductReviews} from '~/lib/judgeme.server';
import {settleDeferred} from '~/lib/deferred.server';

const EMPTY_REVIEWS = {provider: 'Judge.me' as const, reviews: []};
const REVIEWS_API_TIMEOUT_MS = 3_000;

export async function loader({request, context}: Route.LoaderArgs) {
  const productId = new URL(request.url).searchParams.get('productId');

  if (!productId || !/^gid:\/\/shopify\/Product\/\d+$/.test(productId)) {
    return Response.json({error: 'Invalid product'}, {status: 400});
  }

  const reviews = await settleDeferred(
    getJudgeMeProductReviews({
      cache: context.reviewsCache,
      shopDomain: context.env.JUDGEME_SHOP_DOMAIN,
      privateApiToken: context.env.JUDGEME_PRIVATE_API_TOKEN,
      shopifyProductGid: productId,
      monitor: context.monitor,
    }),
    EMPTY_REVIEWS,
    REVIEWS_API_TIMEOUT_MS,
  );

  return Response.json(reviews, {
    headers: {
      'Cache-Control':
        'public, max-age=60, s-maxage=300, stale-while-revalidate=900',
    },
  });
}
