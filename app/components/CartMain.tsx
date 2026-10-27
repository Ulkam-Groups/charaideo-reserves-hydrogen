import {
  Image,
  Money,
} from '@shopify/hydrogen';
import {startTransition, useEffect, useRef, useState} from 'react';
import {Link, useFetchers, useRouteLoaderData} from 'react-router';
import type {
  CartApiQueryFragment,
  CartRecommendationsQuery,
} from 'storefrontapi.generated';
import type {loader as rootLoader} from '~/root';
import {DiscountProgress} from '~/components/DiscountProgress';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {CartSummary, SecurePayments} from './CartSummary';
import {AddToCartButton} from './AddToCartButton';
import {
  RECENT_PRODUCTS_UPDATED_EVENT,
  readRecentProducts,
  type RecentProduct,
} from '~/lib/recent-products';
import {
  invalidateCartReconciliation,
  publishCart,
  reconcileCartState,
} from '~/lib/cart-sync';
import {useSyncedCart} from '~/hooks/useSyncedCart';
import {
  cartDiscountProgressItems,
  discountProgressAmount,
  isDiscountProgressItemEligible,
  type DiscountProgressMilestone,
} from '~/lib/discount-progress';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};

type GeneratedCartRecommendation = NonNullable<
  CartRecommendationsQuery['productRecommendations']
>[number];

type CartRecommendationProduct = Omit<
  GeneratedCartRecommendation,
  'selectedOrFirstAvailableVariant'
> & {
  selectedOrFirstAvailableVariant:
    | (NonNullable<
        GeneratedCartRecommendation['selectedOrFirstAvailableVariant']
      > & {
        title: string;
        price: GeneratedCartRecommendation['priceRange']['minVariantPrice'];
        product: {
          id: string;
          collections: {nodes: Array<{id: string}>};
        };
      })
    | null;
};
/** Returns a map of all line items and their children. */
function getLineItemChildrenMap(lines: CartLine[]): LineItemChildrenMap {
  const children: LineItemChildrenMap = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line) {
      const children = getLineItemChildrenMap(line.lineComponents);
      for (const [parentId, childIds] of Object.entries(children)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}
/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({layout, cart: originalCart}: CartMainProps) {
  const cart = useSyncedCart(originalCart);
  const [refreshingCart, setRefreshingCart] = useState(false);
  const mutationWasPending = useRef(false);
  const reconciliationController = useRef<AbortController | null>(null);
  const fetchers = useFetchers();
  const cartMutationPending = fetchers.some(
    (fetcher) =>
      fetcher.state !== 'idle' &&
      Boolean(
        fetcher.formAction &&
          new URL(fetcher.formAction, 'https://storefront.invalid').pathname === '/cart',
      ),
  );
  useEffect(() => {
    if (cartMutationPending) {
      mutationWasPending.current = true;
      reconciliationController.current?.abort();
      reconciliationController.current = null;
      invalidateCartReconciliation();
      startTransition(() => setRefreshingCart(true));
      return;
    }
    if (!mutationWasPending.current) return;
    mutationWasPending.current = false;
    const controller = new AbortController();
    reconciliationController.current = controller;

    void reconcileCartState()
      .then((confirmedCart) => {
        if (!controller.signal.aborted && confirmedCart) publishCart(confirmedCart);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error('Cart refresh failed');
      })
      .finally(() => {
        if (reconciliationController.current !== controller) return;
        reconciliationController.current = null;
        startTransition(() => setRefreshingCart(false));
      });

    return () => controller.abort();
  }, [cartMutationPending]);

  const cartBusy = cartMutationPending || refreshingCart;

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart && Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main cart-main--${layout} ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const childrenMap = getLineItemChildrenMap(cart?.lines?.nodes ?? []);
  const discountItems = cartDiscountProgressItems(cart);
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const discountMilestones = rootData?.cartDiscountProgress.milestones ?? [];
  const freeShippingMilestone =
    rootData?.cartDiscountProgress.status === 'ready'
      ? discountMilestones.find(
          (milestone) =>
            milestone.reward === 'Free shipping' &&
            milestone.method === 'automatic',
        )
      : undefined;
  const freeShippingMessage = freeShippingMilestone
    ? `On orders of ${new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: freeShippingMilestone.currencyCode,
        maximumFractionDigits: 0,
      }).format(freeShippingMilestone.threshold)} or more`
    : 'Shipping calculated at checkout';
  const appliedMilestoneIds = discountMilestones
    .filter((milestone) =>
      (cart?.lines?.nodes ?? []).some((line) =>
        isMilestoneAppliedToLine(
          milestone,
          (line as typeof line & {
            discountAllocations?: Array<{title?: string; code?: string}>;
          }).discountAllocations ?? [],
        ),
      ),
    )
    .map(({id}) => id);

  return (
    <div className={className} aria-busy={cartBusy}>
      {cartBusy && (
        <div className="cart-update-overlay" role="status" aria-live="polite">
          <span className="cart-update-spinner" aria-hidden="true" />
          <strong>Updating your cart…</strong>
        </div>
      )}
      {layout === 'page' && (
        <header className="cart-page-head">
          <div>
            <nav className="cart-page-crumbs" aria-label="Breadcrumb">
              <Link to="/" prefetch="none">
                Home
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Cart</span>
            </nav>
            <h1>
              Your cart
              {cartHasItems && (
                <small>
                  {cart?.totalQuantity} {cart?.totalQuantity === 1 ? 'item' : 'items'}
                </small>
              )}
            </h1>
          </div>
          {cartHasItems && (
            <Link className="cart-page-continue" to="/reserve-list" prefetch="none">
              Continue shopping
            </Link>
          )}
        </header>
      )}
      {linesCount && (
        <DiscountProgress
          surface="cart"
          detailsMode={layout === 'aside' ? 'popup' : 'inline'}
          paused={cartBusy}
          items={discountItems}
          milestones={rootData?.cartDiscountProgress.milestones ?? []}
          status={rootData?.cartDiscountProgress.status ?? 'unavailable'}
          appliedMilestoneIds={appliedMilestoneIds}
        />
      )}
      <div
        aria-hidden={cartBusy || undefined}
        style={{display: 'contents', ...(cartBusy ? {visibility: 'hidden'} : {})}}
      >
        <CartEmpty hidden={linesCount} layout={layout} />
      </div>
      <div
        className="cart-details"
        hidden={!linesCount}
      >
        <div className="cart-lines-wrap" aria-busy={cartBusy}>
          <h2 id="cart-lines" className="cart-section-label">
            <span>In your cart</span>
            <b>{cart?.totalQuantity ?? 0}</b>
          </h2>
          <ul aria-labelledby="cart-lines">
            {(cart?.lines?.nodes ?? []).map((line) => {
              // we do not render non-parent lines at the root of the cart
              if ('parentRelationship' in line && line.parentRelationship?.parent) {
                return null;
              }
              const discountItem = discountItems.find(
                (item) => item.variantId === line.merchandise.id,
              );
              const eligibleMilestones = discountItem
                ? discountMilestones.filter(
                    (milestone) =>
                      milestone.productSpecific &&
                      isDiscountProgressItemEligible(milestone, discountItem),
                  )
                : [];
              const allocations = (
                line as typeof line & {
                  discountAllocations?: Array<{
                    __typename?: string;
                    title?: string;
                    code?: string;
                  }>;
                }
              ).discountAllocations ?? [];
              const appliedMilestone = [...eligibleMilestones]
                .reverse()
                .find((milestone) =>
                  isMilestoneAppliedToLine(milestone, allocations),
                );
              const nextMilestone = eligibleMilestones.find(
                (milestone) =>
                  discountProgressAmount(milestone, discountItems) <
                  milestone.threshold,
              );
              const discountOffer = appliedMilestone
                ? {reward: appliedMilestone.reward, status: 'applied' as const}
                : nextMilestone
                  ? {reward: nextMilestone.reward, status: 'eligible' as const}
                  : undefined;

              return (
                <CartLineItem
                  key={line.id}
                  line={line}
                  layout={layout}
                  childrenMap={childrenMap}
                  discountOffer={discountOffer}
                />
              );
            })}
          </ul>
          {layout === 'page' && (
            <ul className="cart-trust" aria-label="Our promise">
              <li>
                <span className="trust-color-icon" aria-hidden="true">🚚</span>
                <strong>Free delivery</strong>
                <span>{freeShippingMessage}</span>
              </li>
              <li>
                <span className="trust-color-icon" aria-hidden="true">🍃</span>
                <strong>Fresh from Assam</strong>
                <span>Packed in small batches</span>
              </li>
              <li className="cart-trust-secure">
                <SecurePayments />
              </li>
            </ul>
          )}
          <CartRecommendations
            layout={layout}
            discountItems={discountItems}
            discountMilestones={discountMilestones}
            productIds={(cart?.lines?.nodes ?? []).map(
              (line) => line.merchandise.product.id,
            )}
          />
        </div>
        {cartHasItems && cart && <CartSummary cart={cart} layout={layout} />}
      </div>
    </div>
  );
}

function isMilestoneAppliedToLine(
  milestone: DiscountProgressMilestone,
  allocations: ReadonlyArray<{title?: string; code?: string}>,
) {
  if (milestone.method === 'code') {
    const milestoneCodes = new Set(milestone.codes.map((code) => code.toLowerCase()));
    return allocations.some(
      ({code}) => code && milestoneCodes.has(code.toLowerCase()),
    );
  }

  return allocations.some(({title}) => title === milestone.title);
}

function CartRecommendations({
  productIds,
  layout,
  discountItems,
  discountMilestones,
}: {
  productIds: string[];
  layout: CartLayout;
  discountItems: ReturnType<typeof cartDiscountProgressItems>;
  discountMilestones: DiscountProgressMilestone[];
}) {
  const {type} = useAside();
  const active = layout === 'page' || type === 'cart';
  const cartProductIds = [...new Set(productIds)];
  const productKey = cartProductIds.join('|');
  const [response, setResponse] = useState<{
    key: string;
    recommendations: CartRecommendationProduct[];
    unavailable: boolean;
  } | null>(null);
  const [loadingKey, setLoadingKey] = useState('');

  useEffect(() => {
    if (!active || !productKey || response?.key === productKey) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      cartProductIds.slice(0, 3).forEach((id) => params.append('productId', id));
      cartProductIds.forEach((id) => params.append('excludeProductId', id));
      startTransition(() => setLoadingKey(productKey));

      void fetch(`/api/cart-recommendations?${params.toString()}`, {
        signal: controller.signal,
        headers: {Accept: 'application/json'},
      })
        .then(async (request) => {
          if (!request.ok) throw new Error(`Recommendations failed: ${request.status}`);
          return request.json() as Promise<{
            recommendations: CartRecommendationProduct[];
            unavailable: boolean;
          }>;
        })
        .then((result) => {
          startTransition(() => {
            setResponse({key: productKey, ...result});
            setLoadingKey('');
          });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          startTransition(() => {
            setResponse({key: productKey, recommendations: [], unavailable: true});
            setLoadingKey('');
          });
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [productKey, active, response?.key]);

  if (!active || !productKey) return null;
  const isCurrentResponse = response?.key === productKey;
  const loading = loadingKey === productKey || !isCurrentResponse;
  const recommendations = isCurrentResponse ? response.recommendations : [];
  const unavailable = isCurrentResponse && response.unavailable;
  if (!loading && !unavailable && recommendations.length === 0) return null;

  return (
    <section
      className="cart-recommendations"
      aria-labelledby="cart-recommendations-title"
    >
      <h3 id="cart-recommendations-title">
        <span className="cart-reco-badge">Add-ons</span>
        Frequently bought together
      </h3>
      {loading ? (
        <p className="cart-recommendations-status" role="status">
          Finding a good pairing…
        </p>
      ) : unavailable ? (
        <p className="cart-recommendations-status" role="status">
          Pairings are temporarily unavailable.
        </p>
      ) : recommendations.length ? (
        <ul>
          {recommendations.map((product) => {
            const variant = product.selectedOrFirstAvailableVariant;
            const recommendationItem = variant
              ? {
                  productId: product.id,
                  variantId: variant.id,
                  collectionIds:
                    variant.product?.collections.nodes.map(({id}) => id) ?? [],
                  amount: Number(variant.price.amount),
                  currencyCode: variant.price.currencyCode,
                }
              : null;
            const eligibleReward = recommendationItem
              ? nextEligibleDiscountReward(
                  discountMilestones,
                  discountItems,
                  recommendationItem,
                )
              : null;
            return (
              <li key={product.id} className="cart-recommendation">
                <Link
                  className="cart-recommendation-image"
                  to={`/products/${encodeURIComponent(product.handle)}`}
                  prefetch="none"
                  aria-label={`View ${product.title}`}
                >
                  {product.featuredImage ? (
                    <Image
                      data={product.featuredImage}
                      alt={product.featuredImage.altText || product.title}
                      sizes="72px"
                      loading="lazy"
                    />
                  ) : (
                    <span aria-hidden="true">CR</span>
                  )}
                </Link>
                <div className="cart-recommendation-copy">
                  <Link
                    to={`/products/${encodeURIComponent(product.handle)}`}
                    prefetch="none"
                  >
                    {product.title}
                  </Link>
                  {((variant && variant.title !== 'Default Title') || eligibleReward) && (
                    <div className="cart-recommendation-meta">
                      {variant && variant.title !== 'Default Title' && (
                        <small>{variant.title}</small>
                      )}
                      {eligibleReward && (
                        <span className="cart-discount-eligibility is-eligible is-compact">
                          {eligibleReward} eligible
                        </span>
                      )}
                    </div>
                  )}
                  {variant ? (
                    <Money data={variant.price} />
                  ) : (
                    <Money data={product.priceRange.minVariantPrice} />
                  )}
                </div>
                <AddToCartButton
                  lines={variant ? [{merchandiseId: variant.id, quantity: 1, selectedVariant: variant}] : []}
                  disabled={!variant?.availableForSale}
                >
                  <span aria-hidden="true">+</span> Add
                </AddToCartButton>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function nextEligibleDiscountReward(
  milestones: readonly DiscountProgressMilestone[],
  items: ReturnType<typeof cartDiscountProgressItems>,
  item: Parameters<typeof isDiscountProgressItemEligible>[1],
) {
  const eligibleMilestones = milestones.filter(
    (milestone) =>
      milestone.productSpecific &&
      isDiscountProgressItemEligible(milestone, item),
  );

  return (
    eligibleMilestones.find(
      (milestone) =>
        discountProgressAmount(milestone, items) < milestone.threshold,
    ) ?? eligibleMilestones.at(-1)
  )?.reward;
}

function CartEmpty({
  hidden = false,
  layout = 'page',
}: {
  hidden: boolean;
  layout?: CartMainProps['layout'];
}) {
  const {close} = useAside();
  const [recentProduct, setRecentProduct] = useState<RecentProduct | null>(null);

  useEffect(() => {
    const refreshRecentProduct = () => {
      try {
        setRecentProduct(readRecentProducts(window.localStorage)[0] ?? null);
      } catch {
        setRecentProduct(null);
      }
    };

    refreshRecentProduct();
    window.addEventListener(RECENT_PRODUCTS_UPDATED_EVENT, refreshRecentProduct);
    return () =>
      window.removeEventListener(RECENT_PRODUCTS_UPDATED_EVENT, refreshRecentProduct);
  }, []);

  return (
    <div
      aria-live="polite"
      className={`cart-empty cart-empty--${layout}${
        recentProduct ? ' cart-empty--has-suggestion' : ''
      }`}
      hidden={hidden}
    >
      <div className="cart-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M10 15h23v9.5C33 32 28 37 21.5 37S10 32 10 24.5V15Z" />
          <path d="M33 19h2.5a5.5 5.5 0 0 1 0 11H32" />
          <path d="M8 41h29" />
          <path d="M17 10c0-2 2-2.5 2-4.5M25 10c0-2 2-2.5 2-4.5" />
        </svg>
      </div>
      <span className="cart-empty-eyebrow">
        {recentProduct ? 'A recent pour' : 'Your tea cabinet'}
      </span>
      <h2>{recentProduct ? 'Still thinking about this tea?' : 'Your cart is empty.'}</h2>
      <p className="cart-empty-message">
        {recentProduct
          ? 'Pick up where you left off, or keep exploring the reserve.'
          : 'Your table is waiting. Find a tea to make it yours.'}
      </p>
      {recentProduct && <RecentProductSuggestion product={recentProduct} />}
      <Link
        className={
          recentProduct ? 'cart-empty-browse' : 'button primary cart-empty-action'
        }
        to="/reserve-list"
        onClick={close}
        prefetch="none"
      >
        {recentProduct ? 'View the reserve list' : 'Explore reserves'}
      </Link>
    </div>
  );
}

function RecentProductSuggestion({product}: {product: RecentProduct}) {
  const productUrl = `/products/${encodeURIComponent(product.handle)}`;
  const variantLabel =
    product.variantTitle === 'Default Title' ? 'Selected reserve' : product.variantTitle;

  return (
    <article className="cart-empty-suggestion">
      <Link
        aria-label={`View ${product.title}`}
        className="cart-empty-suggestion-image"
        prefetch="none"
        to={productUrl}
      >
        {product.image ? (
          <img src={product.image.url} alt={product.image.altText} loading="lazy" />
        ) : (
          <span aria-hidden="true">CR</span>
        )}
      </Link>
      <div className="cart-empty-suggestion-details">
        <span>Recently viewed</span>
        <h3>
          <Link prefetch="none" to={productUrl}>
            {product.title}
          </Link>
        </h3>
        <div className="cart-empty-suggestion-meta">
          <span>{variantLabel}</span>
          <strong>{formatRecentProductPrice(product)}</strong>
        </div>
      </div>
      <AddToCartButton
        lines={[{
          merchandiseId: product.variantId,
          quantity: 1,
          selectedVariant: {
            id: product.variantId,
            title: product.variantTitle,
            availableForSale: true,
            price: product.price,
            image: product.image,
            selectedOptions: [{name: 'Title', value: product.variantTitle}],
            product: {handle: product.handle, title: product.title},
          },
        }]}
      >
        Add
      </AddToCartButton>
    </article>
  );
}

function formatRecentProductPrice(product: RecentProduct) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: product.price.currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(product.price.amount));
  } catch {
    return `${product.price.currencyCode} ${product.price.amount}`;
  }
}
