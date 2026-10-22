import {Await, Link, useNavigate, useRouteLoaderData} from 'react-router';
import {Money, type MappedProductOptions, useAnalytics} from '@shopify/hydrogen';
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
import {Suspense, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useCheckoutError} from '~/lib/checkout/checkout-errors';
import {DeliveryEstimate} from './DeliveryEstimate';
import {DiscountProgress} from './DiscountProgress';
import {META_ANALYTICS_EVENTS, metaContentId} from '~/lib/ads/meta/meta-pixel';
import {cartDiscountProgressItems} from '~/lib/discount-progress';
import {PaymentLogos} from './PaymentLogos';

export function ProductForm({
  productOptions,
  selectedVariant,
  productId,
  productCollectionIds,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  productId: string;
  productCollectionIds: string[];
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const {publish} = useAnalytics();
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const buyNowVariantId = selectedVariant?.id;
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const mobileBarRef = useRef<HTMLElement>(null);
  const quantityLimitTooltipId = useId();
  useCheckoutError(setCheckoutError);

  const availableQuantity =
    selectedVariant &&
    !selectedVariant.currentlyNotInStock &&
    typeof selectedVariant.quantityAvailable === 'number'
      ? Math.max(0, selectedVariant.quantityAvailable)
      : null;
  const quantityAtLimit =
    availableQuantity !== null && quantity >= availableQuantity;
  const quantityLimitMessage = quantityAtLimit
    ? `Only ${availableQuantity} available right now.`
    : undefined;

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

  useEffect(() => {
    const bar = mobileBarRef.current;
    const footer = document.querySelector<HTMLElement>('.site-footer');
    if (!showMobileBar || !bar || !footer) return;

    let frame = 0;
    const updateFooterOffset = () => {
      frame = 0;
      const overlap = Math.max(
        0,
        window.innerHeight - footer.getBoundingClientRect().top,
      );
      bar.style.setProperty('--footer-overlap', `${overlap}px`);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateFooterOffset);
    };

    updateFooterOffset();
    window.addEventListener('scroll', scheduleUpdate, {passive: true});
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [showMobileBar]);

  const stockLabel = !selectedVariant?.availableForSale
    ? 'Out of stock'
    : selectedVariant.currentlyNotInStock
      ? 'Available to order'
      : 'In stock';
  const selectedSize = selectedVariant?.selectedOptions.find(
    (option) => option.name.toLowerCase() === 'size',
  )?.value;
  const selectedWeightInGrams = weightInGrams(selectedSize);
  const pricePerGram =
    selectedVariant && selectedWeightInGrams
      ? Number(selectedVariant.price.amount) / selectedWeightInGrams
      : null;
  const selectedDiscountItem = selectedVariant
    ? {
        productId,
        variantId: selectedVariant.id,
        collectionIds: productCollectionIds,
        amount: Number(selectedVariant.price.amount),
        currencyCode: selectedVariant.price.currencyCode,
      }
    : null;

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
                      data-available={available}
                      key={option.name + name}
                      prefetch="none"
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
                      data-available={available}
                      key={option.name + name}
                      style={{
                        border: selected ? '1px solid black' : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      aria-pressed={selected}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          publish('custom_product_variant_selected', {
                            optionName: option.name,
                            optionValue: name,
                            available,
                          });
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
          </div>
        );
      })}
      {pricePerGram && selectedVariant && (
        <div className="product-unit-price">
          <Money
            as="span"
            data={{
              amount: pricePerGram.toFixed(2),
              currencyCode: selectedVariant.price.currencyCode,
            }}
          />{' '}
          per gram
        </div>
      )}
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
      </div>
      <div className="product-actions" ref={actionsRef}>
        {selectedVariant?.availableForSale && (
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
              <span
                className="product-quantity-increase"
                tabIndex={quantityAtLimit ? 0 : undefined}
              >
                <button
                  type="button"
                  aria-label={
                    quantityLimitMessage
                      ? `Increase quantity unavailable. ${quantityLimitMessage}`
                      : 'Increase quantity'
                  }
                  aria-describedby={
                    quantityLimitMessage ? quantityLimitTooltipId : undefined
                  }
                  disabled={quantityAtLimit}
                  onClick={() =>
                    setQuantity((value) =>
                      Math.min(availableQuantity ?? 99, value + 1),
                    )
                  }
                >
                  +
                </button>
              </span>
            </div>
            {quantityLimitMessage && (
              <span
                className="product-quantity-tooltip"
                id={quantityLimitTooltipId}
                role="tooltip"
              >
                {quantityLimitMessage}
              </span>
            )}
          </div>
        )}
        {(!selectedVariant || selectedVariant.availableForSale) && (
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
            Add to cart
          </AddToCartButton>
        )}
        {selectedVariant && !selectedVariant.availableForSale && (
          <NotifyMeForm
            key={selectedVariant.id}
            productHandle={selectedVariant.product.handle}
            productTitle={selectedVariant.product.title.split('|')[0].trim()}
            variantTitle={selectedVariant.title}
          />
        )}
        {selectedVariant?.availableForSale && buyNowVariantId && (
          <button
            type="button"
            className="button secondary product-buy-now"
            disabled={
              !rootData?.checkoutReady ||
              !rootData.checkoutCountrySupported ||
              checkoutPending ||
              !canStartCheckout(rootData.checkoutProvider, [
                {variantId: buyNowVariantId, quantity},
              ])
            }
            onClick={async () => {
              setCheckoutPending(true);
              publish('custom_buy_now_started', {
                quantity,
                variantId: buyNowVariantId,
              });
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
                  const contentId = metaContentId(buyNowVariantId);
                  const itemPrice = Number(selectedVariant.price.amount);
                  if (contentId && Number.isFinite(itemPrice)) {
                    publish(META_ANALYTICS_EVENTS.INITIATE_CHECKOUT, {
                      currency: selectedVariant.price.currencyCode,
                      value: itemPrice * quantity,
                      items: [
                        {
                          id: contentId,
                          name: `${selectedVariant.product.title} - ${selectedVariant.title}`,
                          quantity,
                          itemPrice,
                        },
                      ],
                    });
                  }
                }
              } finally {
                setCheckoutPending(false);
              }
            }}
          >
            <span>Buy now</span>
            {rootData?.checkoutProvider === 'razorpay' && (
              <PaymentLogos methods={['Visa', 'Mastercard', 'UPI']} />
            )}
          </button>
        )}
      </div>
      {selectedVariant?.availableForSale && !rootData?.checkoutReady && (
        <p role="status">Checkout is being configured.</p>
      )}
      {selectedVariant?.availableForSale &&
        rootData &&
        !rootData.checkoutCountrySupported && (
          <p role="status">Currently shipping within India only.</p>
        )}
      {checkoutError && <p role="alert">{checkoutError}</p>}
      {selectedVariant?.availableForSale &&
        selectedDiscountItem &&
        rootData?.cart && (
          <Suspense fallback={null}>
            <Await resolve={rootData.cart} errorElement={null}>
              {(cart) => (
                <DiscountProgress
                  surface="product"
                  eligibilityItems={[selectedDiscountItem]}
                  items={cartDiscountProgressItems(cart)}
                  milestones={rootData.cartDiscountProgress.milestones}
                  status={rootData.cartDiscountProgress.status}
                />
              )}
            </Await>
          </Suspense>
        )}
      <DeliveryEstimate />
      {showMobileBar && selectedVariant && !selectedVariant.availableForSale && (
        <aside
          ref={mobileBarRef}
          className="product-mobile-purchase-bar"
          aria-label={`Quick purchase for ${selectedVariant.product.title}`}
        >
          <div>
            <span>{selectedVariant.product.title}</span>
            <strong>Currently sold out</strong>
            <small>
              {selectedSize ? `Size: ${selectedSize}` : selectedVariant.title}
            </small>
          </div>
          <button
            type="button"
            className="button"
            onClick={() => document.getElementById(NOTIFY_TRIGGER_ID)?.click()}
          >
            Notify me
          </button>
        </aside>
      )}
      {showMobileBar && selectedVariant?.availableForSale && (
        <aside
          ref={mobileBarRef}
          className="product-mobile-purchase-bar"
          aria-label={`Quick purchase for ${selectedVariant.product.title}`}
        >
          <div>
            <span>{selectedVariant.product.title}</span>
            <strong>
              <Money data={selectedVariant.price} />
              {quantity > 1 && ` × ${quantity}`}
            </strong>
            <small>
              {selectedSize ? `Size: ${selectedSize}` : selectedVariant.title}
            </small>
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

const NOTIFY_TRIGGER_ID = 'notify-trigger';

function NotifyMeForm({
  productHandle,
  productTitle,
  variantTitle,
}: {
  productHandle: string;
  productTitle: string;
  variantTitle: string;
}) {
  const {publish} = useAnalytics();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done'>('idle');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const showVariant = variantTitle && variantTitle !== 'Default Title';

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'pending') return;
    setStatus('pending');
    setError('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, consent: true, product: productHandle}),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error || 'Unable to join the list. Please try again.');
      }
      publish('custom_back_in_stock_requested', {productHandle});
      setStatus('done');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to join the list. Please try again.',
      );
      setStatus('idle');
    }
  }

  const modal = open ? (
    <div className="notify-modal">
      <button
        type="button"
        className="notify-backdrop"
        aria-label="Close waitlist"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
      <div
        className="notify-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notify-title"
      >
        <button
          type="button"
          className="notify-close"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {status === 'done' ? (
          <div className="notify-success" role="status">
            <span className="notify-success-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h3 id="notify-title">You’re on the list</h3>
            <p>We’ll email you the moment {productTitle} is back in stock.</p>
            <button
              type="button"
              className="notify-submit"
              onClick={() => setOpen(false)}
            >
              Continue browsing
            </button>
          </div>
        ) : (
          <>
            <span className="notify-eyebrow">Back in stock alert</span>
            <h3 id="notify-title">Be first to know</h3>
            <p className="notify-product">
              {productTitle}
              {showVariant ? ` · ${variantTitle}` : ''}
            </p>
            <p className="notify-copy">
              This tea is sold out right now. Leave your email and we’ll tell you as soon
              as it returns. No payment needed.
            </p>
            <form onSubmit={submit} noValidate={false}>
              <label htmlFor="notify-email">Email address</label>
              <input
                id="notify-email"
                ref={inputRef}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'notify-error' : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
              {error && (
                <p className="notify-error" id="notify-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="notify-submit"
                disabled={status === 'pending'}
              >
                {status === 'pending' ? 'Saving…' : 'Notify me'}
              </button>
              <small>
                By joining you agree to receive a back-in-stock email. No spam,
                unsubscribe anytime.
              </small>
            </form>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {status === 'done' ? (
        <p className="product-notify-done" role="status">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          You’re on the list. We’ll email you when it’s back.
        </p>
      ) : (
        <button
          type="button"
          id={NOTIFY_TRIGGER_ID}
          className="button product-notify-trigger"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Notify me
        </button>
      )}
      {modal && createPortal(modal, document.body)}
    </>
  );
}

function weightInGrams(value?: string) {
  if (!value) return null;
  const match = value.trim().match(/([\d.]+)\s*(kg|kilograms?|g|grams?)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return /^(kg|kilogram)/i.test(match[2]) ? amount * 1000 : amount;
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
