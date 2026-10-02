import {useEffect, useState} from 'react';
import {ProductReviews} from '~/components/ProductReviews';
import type {ProductReviewsResult} from '~/lib/judgeme.server';

const BROWSER_REVIEWS_TIMEOUT_MS = 4_000;

export function AsyncProductReviews({
  productId,
  fallbackRating,
  fallbackCount,
}: {
  productId: string;
  fallbackRating: number | null;
  fallbackCount: number;
}) {
  const [state, setState] = useState<
    | {status: 'loading'}
    | {status: 'ready'; data: ProductReviewsResult}
    | {status: 'unavailable'}
  >({status: 'loading'});

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      BROWSER_REVIEWS_TIMEOUT_MS,
    );
    let active = true;

    void fetch(
      `/api/product-reviews?productId=${encodeURIComponent(productId)}`,
      {headers: {Accept: 'application/json'}, signal: controller.signal},
    )
      .then((response) => {
        if (!response.ok) throw new Error('Reviews unavailable');
        return response.json() as Promise<ProductReviewsResult>;
      })
      .then((data) => {
        if (active) setState({status: 'ready', data});
      })
      .catch(() => {
        if (active) setState({status: 'unavailable'});
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [productId]);

  if (state.status === 'loading') return <ReviewsSkeleton />;

  if (state.status === 'unavailable') {
    return (
      <div className="product-reviews-empty" role="status">
        <h3>Customer notes are temporarily unavailable.</h3>
        <p>You can still select a size and order this tea.</p>
      </div>
    );
  }

  return (
    <ProductReviews
      data={state.data}
      fallbackRating={fallbackRating}
      fallbackCount={fallbackCount}
    />
  );
}

function ReviewsSkeleton() {
  return (
    <div className="product-reviews-loading" aria-label="Loading customer reviews">
      <span />
      <span />
      <span />
    </div>
  );
}
