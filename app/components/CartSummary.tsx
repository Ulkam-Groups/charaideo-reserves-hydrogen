import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {useFetcher, useRouteLoaderData} from 'react-router';
import type {loader as rootLoader} from '~/root';
import {canStartCheckout} from '~/lib/checkout/checkout';
import {startCheckout} from '~/lib/checkout/checkout.client';
import {useAside} from '~/components/Aside';

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

function CartCheckoutActions({cart, layout}: {cart: CartSummaryProps['cart']; layout: CartLayout}) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const {close} = useAside();
  const [checkoutError, setCheckoutError] = useState('');
  if (!cart?.lines?.nodes?.length) return null;

  const products = cart.lines.nodes.map((line) => ({
    variantId: line.merchandise.id,
    quantity: line.quantity,
  }));
  const canUseCheckout = Boolean(
    rootData?.checkoutReady &&
      canStartCheckout(rootData.checkoutProvider, products) &&
      !cart.isOptimistic &&
      !cart.appliedGiftCards?.length,
  );

  function handleCheckout() {
    if (!canUseCheckout) return;
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

    if (!startCheckout(rootData?.checkoutProvider, {
      source: 'cart',
      products,
      ...(couponCode ? {couponCode} : {}),
      ...(utmParams ? {utmParams} : {}),
      ...(Object.keys(cartAttributes).length ? {cartAttributes} : {}),
    })) {
      setCheckoutError('Checkout is temporarily unavailable. Please try again shortly.');
    } else {
      setCheckoutError('');
      if (layout === 'aside') close();
    }
  }

  return (
    <div>
      <button className="button primary checkout-button" type="button" onClick={handleCheckout} disabled={!canUseCheckout}>
        <span>Checkout with Shiprocket &rarr;</span>
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
