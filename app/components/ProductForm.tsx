import {Link, useNavigate, useRouteLoaderData} from 'react-router';
import {Money, type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';
import type {loader as rootLoader} from '~/root';
import {canStartCheckout} from '~/lib/checkout/checkout';
import {startCheckout} from '~/lib/checkout/checkout.client';
import {useEffect, useRef, useState} from 'react';
import {useCheckoutError} from '~/lib/checkout/checkout-errors';
import {DeliveryEstimate} from './DeliveryEstimate';

export function ProductForm({
  productOptions,
  selectedVariant,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const buyNowVariantId = selectedVariant?.id;
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  useCheckoutError(setCheckoutError);

  useEffect(() => {
    setQuantity(1);
  }, [selectedVariant?.id]);

  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setShowMobileBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(actions);
    return () => observer.disconnect();
  }, []);

  const stockLabel = !selectedVariant?.availableForSale
    ? 'Out of stock'
    : selectedVariant.currentlyNotInStock
      ? 'Available to order'
      : 'In stock';

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <h5>{option.name}</h5>
            <div className="product-options-grid">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      style={{
                        border: selected ? '1px solid black' : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
                  return (
                    <button
                      type="button"
                      className={`product-options-item${
                        exists && !selected ? ' link' : ''
                      }`}
                      key={option.name + name}
                      style={{
                        border: selected ? '1px solid black' : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      aria-pressed={selected}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
            <br />
          </div>
        );
      })}
      <div className="product-purchase-meta">
        <p
          className={`product-stock product-stock--${
            selectedVariant?.availableForSale ? 'available' : 'sold-out'
          }`}
          role="status"
        >
          <span aria-hidden="true" />
          {stockLabel}
        </p>
        <div className="product-quantity" role="group" aria-label="Quantity">
          <span>Quantity</span>
          <div>
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity === 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <output aria-live="polite" aria-label={`${quantity} items`}>
              {quantity}
            </output>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((value) => Math.min(99, value + 1))}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="product-actions" ref={actionsRef}>
        <AddToCartButton
          disabled={!selectedVariant || !selectedVariant.availableForSale}
          onClick={() => {
            open('cart');
          }}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity,
                    selectedVariant,
                  },
                ]
              : []
          }
        >
          {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
        </AddToCartButton>
        {selectedVariant?.availableForSale && buyNowVariantId && (
          <button
            type="button"
            className="button secondary product-buy-now"
            disabled={
              !rootData?.checkoutReady ||
              checkoutPending ||
              !canStartCheckout(rootData.checkoutProvider, [
                {variantId: buyNowVariantId, quantity},
              ])
            }
            onClick={async () => {
              setCheckoutPending(true);
              const utmParams = new URLSearchParams(
                [...new URLSearchParams(window.location.search)].filter(([key]) =>
                  key.startsWith('utm_'),
                ),
              ).toString();
              try {
                if (
                  !(await startCheckout(rootData?.checkoutProvider, {
                    source: 'product',
                    products: [{variantId: buyNowVariantId, quantity}],
                    ...(utmParams ? {utmParams} : {}),
                  }))
                ) {
                  setCheckoutError(
                    'Checkout is temporarily unavailable. Please try again shortly.',
                  );
                } else {
                  setCheckoutError('');
                }
              } finally {
                setCheckoutPending(false);
              }
            }}
          >
            Buy now
          </button>
        )}
      </div>
      {!rootData?.checkoutReady && <p role="status">Checkout is being configured.</p>}
      {checkoutError && <p role="alert">{checkoutError}</p>}
      <p className="product-shipping-note">
        <span aria-hidden="true">✓</span>
        Free shipping on orders above ₹499
      </p>
      <DeliveryEstimate />
      {showMobileBar && selectedVariant?.availableForSale && (
        <aside
          className="product-mobile-purchase-bar"
          aria-label="Quick purchase"
        >
          <div>
            <span>{selectedVariant.product.title}</span>
            <strong>
              <Money data={selectedVariant.price} />
              {quantity > 1 && ` × ${quantity}`}
            </strong>
          </div>
          <AddToCartButton
            lines={[
              {
                merchandiseId: selectedVariant.id,
                quantity,
                selectedVariant,
              },
            ]}
            onClick={() => open('cart')}
          >
            Add to cart
          </AddToCartButton>
        </aside>
      )}
    </div>
  );
}

function ProductOptionSwatch({
  swatch,
  name,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
  name: string;
}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}
