import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {
  CartForm,
  Money,
  type OptimisticCart,
  useAnalytics,
} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {useFetcher, useRouteLoaderData} from 'react-router';
import type {loader as rootLoader} from '~/root';
import {canStartCheckout} from '~/lib/checkout/checkout';
import {startCheckout} from '~/lib/checkout/checkout.client';
import {useAside} from '~/components/Aside';
import {useCheckoutError} from '~/lib/checkout/checkout-errors';
import {RazorpayBrand} from './RazorpayBrand';
import {
  META_ANALYTICS_EVENTS,
  metaContentId,
} from '~/lib/ads/meta/meta-pixel';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

export function CartSummary({cart, layout}: CartSummaryProps) {
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
              {cart?.cost?.subtotalAmount ? <Money data={cart.cost.subtotalAmount} /> : '-'}
            </dd>
          </dl>
          <CartCheckoutActions cart={cart} layout={layout} />
        </div>
      </div>
    );
  }

  return (
    <div aria-labelledby="cart-summary" className={className}>
      <h4 id="cart-summary">Your selection</h4>
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
      <CartDiscounts discountCodes={cart?.discountCodes} />
      <CartGiftCard giftCardCodes={cart?.appliedGiftCards} />
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
              <RazorpayBrand wordmark />
            </>
          ) : (
            <span>Checkout with Shiprocket</span>
          )}
        </span>
      </button>
      {!rootData?.checkoutReady && <p role="status">Checkout is being configured.</p>}
      {!!cart.appliedGiftCards?.length && <p role="status">Remove gift cards to use this checkout.</p>}
      {checkoutError && <p role="alert">{checkoutError}</p>}
      <p className="fine-print">Shipping and applicable taxes calculated at checkout.</p>
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
          &nbsp;
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
