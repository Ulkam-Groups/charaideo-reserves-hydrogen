import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {useFetcher, useRouteLoaderData} from 'react-router';
import type {loader as rootLoader} from '~/root';
import {fastrrVariantId, startFastrrCheckout} from '~/lib/fastrr';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

export function CartSummary({cart, layout}: CartSummaryProps) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';

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
      <CartCheckoutActions cart={cart} />
    </div>
  );
}

function CartCheckoutActions({cart}: {cart: CartSummaryProps['cart']}) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const [checkoutError, setCheckoutError] = useState('');
  if (!cart?.lines?.nodes?.length) return null;

  const products = cart.lines.nodes.map((line) => ({
    variantId: fastrrVariantId(line.merchandise.id),
    quantity: line.quantity,
  }));
  const canUseFastrr = Boolean(
    rootData?.fastrrSellerDomain &&
      products.length > 0 &&
      products.every((product) => product.variantId && product.quantity > 0) &&
      !cart.isOptimistic &&
      !cart.appliedGiftCards?.length,
  );

  function handleCheckout() {
    if (!canUseFastrr) return;
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

    if (!startFastrrCheckout({
      type: 'cart',
      products: products.map(({variantId, quantity}) => ({variantId: variantId!, quantity})),
      ...(couponCode ? {couponCode} : {}),
      ...(utmParams ? {utmParams} : {}),
      ...(Object.keys(cartAttributes).length ? {cartAttributes} : {}),
    })) {
      setCheckoutError('Checkout is temporarily unavailable. Please try again shortly.');
    } else {
      setCheckoutError('');
    }
  }

  return (
    <div>
      <button className="button primary checkout-button" type="button" onClick={handleCheckout} disabled={!canUseFastrr}>
        <span>Checkout with Shiprocket &rarr;</span>
      </button>
      {!rootData?.fastrrSellerDomain && <p role="status">Checkout is being configured.</p>}
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
}: {
  giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
}) {
  const giftCardCodeInput = useRef<HTMLInputElement>(null);
  const giftCardAddFetcher = useFetcher({key: 'gift-card-add'});

  useEffect(() => {
    if (giftCardAddFetcher.data) {
      giftCardCodeInput.current!.value = '';
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

      <AddGiftCardForm fetcherKey="gift-card-add">
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
      </AddGiftCardForm>
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
