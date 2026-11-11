import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {PaymentLogos} from './PaymentLogos';
import type {CartLayout} from '~/components/CartMain';
import {
  CartForm,
  Money,
  useAnalytics,
} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {useFetcher, useRouteLoaderData} from 'react-router';
import type {loader as rootLoader} from '~/root';
import {canStartCheckout} from '~/lib/checkout/checkout';
import {startCheckout} from '~/lib/checkout/checkout.client';
import {useAside} from '~/components/Aside';
import {
  cartDiscountProgressItems,
  combinableDiscountMilestones,
  discountProgressAmount,
  isDiscountProgressEligible,
} from '~/lib/discount-progress';
import {useCheckoutError} from '~/lib/checkout/checkout-errors';
import {
  META_ANALYTICS_EVENTS,
  metaContentId,
} from '~/lib/ads/meta/meta-pixel';

type CartSummaryProps = {
  cart: CartApiQueryFragment & {isOptimistic?: boolean};
  layout: CartLayout;
};

export function CartSummary({cart, layout}: CartSummaryProps) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const progressItems = cartDiscountProgressItems(cart);
  const appliedCodes = (cart?.discountCodes ?? [])
    .filter(({applicable}) => applicable)
    .map(({code}) => code);
  const compatibleMilestones = combinableDiscountMilestones(
    rootData?.cartDiscountProgress.milestones ?? [],
    appliedCodes,
    rootData?.cartDiscountProgress.codeDiscounts ?? [],
  );
  const freeShipping = compatibleMilestones.some(
    (milestone) =>
      /shipping|delivery/i.test(milestone.reward) &&
      isDiscountProgressEligible(milestone, progressItems) &&
      discountProgressAmount(milestone, progressItems) >= milestone.threshold,
  );
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';

  if (layout === 'aside') {
    return (
      <div aria-label="Cart summary" className={className}>
        <details className="cart-drawer-offers">
          <summary>Have a discount code?</summary>
          <div className="cart-drawer-offers-content">
            <CartDiscounts discountCodes={cart?.discountCodes} />
            {!!cart?.appliedGiftCards?.length && (
              <CartGiftCard giftCardCodes={cart.appliedGiftCards} showInput={false} />
            )}
          </div>
        </details>
        <div className="cart-drawer-footer">
          <CartSavings cart={cart} />
          <dl className="cart-subtotal">
            <dt>Subtotal</dt>
            <dd>
              {cart?.cost?.totalAmount ? (
                <Money data={cart.cost.totalAmount} />
              ) : (
                '-'
              )}
            </dd>
          </dl>
          <CartCheckoutActions cart={cart} layout={layout} />
        </div>
      </div>
    );
  }

  return (
    <div aria-labelledby="cart-summary" className={className}>
      <h4 id="cart-summary">Order summary</h4>
      <details className="cart-item-breakdown-details">
        <summary>View item breakup ({cart.totalQuantity} items)</summary>
        <dl className="cart-item-breakdown">
          {(cart?.lines?.nodes ?? []).map((line) => {
            if ('parentRelationship' in line && line.parentRelationship?.parent) return null;
            const lineCost = line.cost as typeof line.cost & {
              subtotalAmount?: typeof line.cost.totalAmount;
            };
            const lineSubtotal = lineCost.subtotalAmount ?? {
              amount: (
                Number(lineCost.amountPerQuantity.amount) * line.quantity
              ).toFixed(2),
              currencyCode: lineCost.amountPerQuantity.currencyCode,
            };
            const subtotal = Number(lineSubtotal.amount);
            const total = Number(lineCost.totalAmount.amount);
            const discount = subtotal - total;
            const hasLineDiscount = Number.isFinite(discount) && discount > 0.001;

            return (
              <div key={line.id}>
                <dt>{line.merchandise.product.title}</dt>
                <dd>
                  <Money as="span" data={line.cost.amountPerQuantity} /> × {line.quantity}
                  {hasLineDiscount && (
                    <>
                      <span aria-hidden="true"> − </span>
                      <Money
                        as="span"
                        data={{
                          amount: discount.toFixed(2),
                          currencyCode: lineSubtotal.currencyCode,
                        }}
                      />
                    </>
                  )}
                  <span aria-hidden="true"> = </span>
                  <strong><Money as="span" data={line.cost.totalAmount} /></strong>
                </dd>
              </div>
            );
          })}
        </dl>
      </details>
      <CartSavings cart={cart} />
      <dl className="cart-subtotal">
        <dt>Subtotal</dt>
        <dd>
          {cart?.cost?.subtotalAmount?.amount ? (
            <Money data={cart?.cost?.subtotalAmount} />
          ) : (
            '-'
          )}
        </dd>
      </dl>
      <dl className="cart-shipping-row">
        <dt>Shipping</dt>
        <dd className={freeShipping ? 'is-free' : undefined}>
          {freeShipping ? 'Free shipping unlocked' : 'Calculated at checkout'}
        </dd>
      </dl>
      <details className="cart-offers" open={Boolean(cart?.discountCodes?.some((c) => c.applicable))}>
        <summary>Have a discount or gift card code?</summary>
        <CartDiscounts discountCodes={cart?.discountCodes} />
        <CartGiftCard giftCardCodes={cart?.appliedGiftCards} />
      </details>
      <dl className="cart-total-row">
        <dt>
          Estimated total
          <small>Inclusive of all taxes</small>
        </dt>
        <dd>
          {cart?.cost?.totalAmount?.amount ? <Money data={cart.cost.totalAmount} /> : '-'}
        </dd>
      </dl>
      <CartCheckoutActions cart={cart} layout={layout} />
    </div>
  );
}

function CartSavings({cart}: {cart: CartSummaryProps['cart']}) {
  const currencyCode = cart?.cost?.subtotalAmount?.currencyCode;
  const allocations = [
    ...(cart?.lines?.nodes ?? []).flatMap(
      (line) => (line as any).discountAllocations ?? [],
    ),
    ...((cart as any)?.discountAllocations ?? []),
  ];
  const saved = allocations.reduce(
    (sum: number, a: any) => sum + Number(a?.discountedAmount?.amount ?? 0),
    0,
  );
  if (!currencyCode || !(saved > 0)) return null;
  return (
    <dl className="cart-savings">
      <dt>You save</dt>
      <dd>
        &minus;
        <Money
          as="span"
          data={{amount: saved.toFixed(2), currencyCode}}
        />
      </dd>
    </dl>
  );
}
function CartCheckoutActions({cart, layout}: {cart: CartSummaryProps['cart']; layout: CartLayout}) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const {close} = useAside();
  const {publish} = useAnalytics();
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);
  useCheckoutError(setCheckoutError);
  if (!cart?.lines?.nodes?.length) return null;

  const products = cart.lines.nodes.map((line) => ({
    variantId: line.merchandise.id,
    quantity: line.quantity,
  }));
  const canUseCheckout = Boolean(
    rootData?.checkoutReady &&
      rootData.checkoutCountrySupported &&
      canStartCheckout(rootData.checkoutProvider, products) &&
      !cart.isOptimistic &&
      !checkoutPending &&
      !cart.appliedGiftCards?.length,
  );

  async function handleCheckout() {
    if (!canUseCheckout) return;
    setCheckoutPending(true);
    const couponCode = cart?.discountCodes?.find((code) => code.applicable)?.code;
    const cartAttributes = Object.fromEntries(
      (cart?.attributes ?? [])
        .filter((attribute): attribute is {key: string; value: string} =>
          typeof attribute.value === 'string',
        )
        .map(({key, value}) => [key, value]),
    );
    const utmParams = new URLSearchParams(
      [...new URLSearchParams(window.location.search)].filter(([key]) =>
        key.startsWith('utm_'),
      ),
    ).toString();

    try {
      if (!await startCheckout(rootData?.checkoutProvider, {
        source: 'cart',
        products,
        ...(couponCode ? {couponCode} : {}),
        ...(utmParams ? {utmParams} : {}),
        ...(Object.keys(cartAttributes).length ? {cartAttributes} : {}),
      })) {
        setCheckoutError('Checkout is temporarily unavailable. Please try again shortly.');
      } else {
        setCheckoutError('');
        const items = cart.lines.nodes.flatMap((line) => {
          const id = metaContentId(line.merchandise.id);
          const itemPrice = Number(line.cost.amountPerQuantity.amount);
          return id && Number.isFinite(itemPrice)
            ? [
                {
                  id,
                  name: `${line.merchandise.product.title} - ${line.merchandise.title}`,
                  brand: line.merchandise.product.vendor,
                  quantity: line.quantity,
                  itemPrice,
                },
              ]
            : [];
        });
        const subtotal = cart.cost?.subtotalAmount;
        const value = Number(subtotal?.amount);
        if (items.length && subtotal && Number.isFinite(value)) {
          publish(META_ANALYTICS_EVENTS.INITIATE_CHECKOUT, {
            currency: subtotal.currencyCode,
            value,
            items,
          });
        }
        if (layout === 'aside') close();
      }
    } finally {
      setCheckoutPending(false);
    }
  }

  return (
    <div>
      <button
        className="button primary checkout-button"
        type="button"
        aria-label={
          rootData?.checkoutProvider === 'razorpay'
            ? 'Checkout with Razorpay'
            : 'Checkout with Shiprocket'
        }
        onClick={handleCheckout}
        disabled={!canUseCheckout}
      >
        <span className="checkout-button-content">
          {rootData?.checkoutProvider === 'razorpay' ? (
            <>
              <span>Checkout with</span>
              <PaymentLogos methods={['Visa', 'Mastercard', 'UPI']} />
            </>
          ) : (
            <span>Checkout with Shiprocket</span>
          )}
        </span>
      </button>
      {layout === 'aside' ? (
        <div className="cart-drawer-notes">
          {!rootData?.checkoutReady && <p role="status">Checkout is being configured.</p>}
          {rootData && !rootData.checkoutCountrySupported && (
            <p role="status">Currently shipping within India only.</p>
          )}
          {!!cart.appliedGiftCards?.length && (
            <p role="status">Remove gift cards to use this checkout.</p>
          )}
          {checkoutError && <p role="alert">{checkoutError}</p>}
          <p className="fine-print">Inclusive of all taxes.</p>
        </div>
      ) : (
        <>
          <div className="checkout-supporting-copy">
            {!rootData?.checkoutReady && <p role="status">Checkout is being configured.</p>}
            {rootData && !rootData.checkoutCountrySupported && (
              <p role="status">Currently shipping within India only.</p>
            )}
            {!!cart.appliedGiftCards?.length && (
              <p role="status">Remove gift cards to use this checkout.</p>
            )}
            <p className="fine-print">
              {layout === 'page'
                ? 'Inclusive of all taxes.'
                : 'Shipping and applicable taxes calculated at checkout.'}
            </p>
          </div>
          {checkoutError && <p role="alert">{checkoutError}</p>}
        </>
      )}
    </div>
  );
}

export function SecurePayments() {
  return (
    <div className="cart-secure">
      <strong>Secure checkout</strong>
      <span>Cards, UPI, Netbanking &amp; Wallets</span>
      <PaymentLogos />
    </div>
  );
}

function CartDiscounts({
  discountCodes,
}: {
  discountCodes?: CartApiQueryFragment['discountCodes'];
}) {
  const codes: string[] =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <div>
      {/* Have existing discount, display it with a remove option */}
      <dl hidden={!codes.length}>
        <div>
          <dt>Discount(s)</dt>
          <UpdateDiscountForm>
            <div className="cart-discount">
              <code>{codes?.join(', ')}</code>
              &nbsp;
              <button type="submit" aria-label="Remove discount">
                Remove
              </button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      <UpdateDiscountForm discountCodes={codes}>
        <div>
          <label htmlFor="discount-code-input" className="sr-only">
            Discount code
          </label>
          <input
            autoComplete="off"
            id="discount-code-input"
            type="text"
            name="discountCode"
            placeholder="Discount code"
          />
          <button type="submit" aria-label="Apply discount code">
            Apply
          </button>
        </div>
      </UpdateDiscountForm>
    </div>
  );
}

function UpdateDiscountForm({
  discountCodes,
  children,
}: {
  discountCodes?: string[];
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

function CartGiftCard({
  giftCardCodes,
  showInput = true,
}: {
  giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
  showInput?: boolean;
}) {
  const giftCardCodeInput = useRef<HTMLInputElement>(null);
  const giftCardAddFetcher = useFetcher({key: 'gift-card-add'});

  useEffect(() => {
    if (giftCardAddFetcher.data && giftCardCodeInput.current) {
      giftCardCodeInput.current.value = '';
    }
  }, [giftCardAddFetcher.data]);

  return (
    <div>
      {giftCardCodes && giftCardCodes.length > 0 && (
        <dl>
          <dt>Applied Gift Card(s)</dt>
          {giftCardCodes.map((giftCard) => (
            <RemoveGiftCardForm key={giftCard.id} giftCardId={giftCard.id}>
              <div className="cart-discount">
                <code>***{giftCard.lastCharacters}</code>
                &nbsp;
                <Money data={giftCard.amountUsed} />
                &nbsp;
                <button type="submit">Remove</button>
              </div>
            </RemoveGiftCardForm>
          ))}
        </dl>
      )}

      {showInput && <AddGiftCardForm fetcherKey="gift-card-add">
        <div>
          <input
            autoComplete="off"
            type="text"
            name="giftCardCode"
            placeholder="Gift card code"
            aria-label="Gift card code"
            ref={giftCardCodeInput}
          />
          &nbsp;
          <button type="submit" disabled={giftCardAddFetcher.state !== 'idle'}>
            Apply
          </button>
        </div>
      </AddGiftCardForm>}
    </div>
  );
}

function AddGiftCardForm({
  fetcherKey,
  children,
}: {
  fetcherKey?: string;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesAdd}
    >
      {children}
    </CartForm>
  );
}

function RemoveGiftCardForm({
  giftCardId,
  children,
}: {
  giftCardId: string;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesRemove}
      inputs={{
        giftCardCodes: [giftCardId],
      }}
    >
      {children}
    </CartForm>
  );
}
