import {useOptimisticCart, type OptimisticCartLine} from '@shopify/hydrogen';
import {Link} from 'react-router';
import {useEffect, useState} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {AddToCartButton} from './AddToCartButton';
import {
  RECENT_PRODUCTS_UPDATED_EVENT,
  readRecentProducts,
  type RecentProduct,
} from '~/lib/recent-products';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};
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
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main cart-main--${layout} ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const childrenMap = getLineItemChildrenMap(cart?.lines?.nodes ?? []);

  return (
    <div className={className}>
      <CartEmpty hidden={linesCount} layout={layout} />
      <div className="cart-details" hidden={!linesCount}>
        <p id="cart-lines" className="sr-only">
          Line items
        </p>
        <div className="cart-lines-wrap">
          <ul aria-labelledby="cart-lines">
            {(cart?.lines?.nodes ?? []).map((line) => {
              // we do not render non-parent lines at the root of the cart
              if (
                'parentRelationship' in line &&
                line.parentRelationship?.parent
              ) {
                return null;
              }
              return (
                <CartLineItem
                  key={line.id}
                  line={line}
                  layout={layout}
                  childrenMap={childrenMap}
                />
              );
            })}
          </ul>
        </div>
        {cartHasItems && <CartSummary cart={cart} layout={layout} />}
      </div>
    </div>
  );
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
    window.addEventListener(
      RECENT_PRODUCTS_UPDATED_EVENT,
      refreshRecentProduct,
    );
    return () =>
      window.removeEventListener(
        RECENT_PRODUCTS_UPDATED_EVENT,
        refreshRecentProduct,
      );
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
      <h2>
        {recentProduct ? 'Still thinking about this tea?' : 'Your cart is empty.'}
      </h2>
      <p className="cart-empty-message">
        {recentProduct
          ? 'Pick up where you left off, or keep exploring the reserve.'
          : 'Your table is waiting. Find a tea to make it yours.'}
      </p>
      {recentProduct && <RecentProductSuggestion product={recentProduct} />}
      <Link
        className={
          recentProduct
            ? 'cart-empty-browse'
            : 'button primary cart-empty-action'
        }
        to="/reserve-list"
        onClick={close}
        prefetch="viewport"
      >
        {recentProduct ? 'View the reserve list' : 'Explore reserves'}{' '}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function RecentProductSuggestion({product}: {product: RecentProduct}) {
  const productUrl = `/products/${encodeURIComponent(product.handle)}`;
  const variantLabel =
    product.variantTitle === 'Default Title'
      ? 'Selected reserve'
      : product.variantTitle;

  return (
    <article className="cart-empty-suggestion">
      <Link
        aria-label={`View ${product.title}`}
        className="cart-empty-suggestion-image"
        prefetch="intent"
        to={productUrl}
      >
        {product.image ? (
          <img
            src={product.image.url}
            alt={product.image.altText}
            loading="lazy"
          />
        ) : (
          <span aria-hidden="true">CR</span>
        )}
      </Link>
      <div className="cart-empty-suggestion-details">
        <span>Recently viewed</span>
        <h3>
          <Link prefetch="intent" to={productUrl}>{product.title}</Link>
        </h3>
        <div className="cart-empty-suggestion-meta">
          <span>{variantLabel}</span>
          <strong>{formatRecentProductPrice(product)}</strong>
        </div>
      </div>
      <AddToCartButton
        lines={[{merchandiseId: product.variantId, quantity: 1}]}
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
