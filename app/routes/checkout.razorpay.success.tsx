import {useEffect, useRef} from 'react';
import {
  data,
  Link,
  redirect,
  type LoaderFunctionArgs,
} from 'react-router';
import {
  parseMetaCommercePayload,
  queueMetaPurchase,
  type MetaCommercePayload,
} from '~/lib/ads/meta/meta-pixel';
import {PreferredSourceButton} from '~/components/PreferredSourceButton';
import {refreshPublishedCart} from '~/lib/cart-sync';

export const meta = () => [
  {title: 'Order confirmed | Charaideo Reserves™'},
  {name: 'robots', content: 'noindex,nofollow'},
];

type CheckoutConfirmation = {
  shopifyOrderName: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  metaPurchase?: MetaCommercePayload;
  clearCart: boolean;
};

function optionalReference(value: unknown, pattern: RegExp) {
  return typeof value === 'string' && pattern.test(value) ? value : undefined;
}

export function loader({context}: LoaderFunctionArgs) {
  const result = context.session.get('razorpayPaymentVerified') as unknown;
  if (
    !result ||
    typeof result !== 'object' ||
    typeof (result as {shopifyOrderId?: unknown}).shopifyOrderId !== 'string' ||
    typeof (result as {shopifyOrderName?: unknown}).shopifyOrderName !== 'string'
  ) {
    throw redirect('/cart');
  }

  const confirmation = result as Record<string, unknown>;
  const pending = context.session.get('razorpayCartClearPending') as unknown;
  const clearCart =
    Boolean(pending) &&
    typeof pending === 'object' &&
    (pending as {razorpayOrderId?: unknown}).razorpayOrderId ===
      confirmation.razorpayOrderId &&
    (pending as {shopifyOrderId?: unknown}).shopifyOrderId ===
      confirmation.shopifyOrderId;
  const metaPurchase = parseMetaCommercePayload(confirmation.metaPurchase);
  context.session.unset('razorpayPaymentVerified');
  return data<CheckoutConfirmation>(
    {
      shopifyOrderName: confirmation.shopifyOrderName as string,
      razorpayOrderId: optionalReference(
        confirmation.razorpayOrderId,
        /^order_[A-Za-z0-9]+$/,
      ),
      razorpayPaymentId: optionalReference(
        confirmation.razorpayPaymentId,
        /^pay_[A-Za-z0-9]+$/,
      ),
      ...(metaPurchase ? {metaPurchase} : {}),
      clearCart,
    },
    {headers: {'Cache-Control': 'private, no-store'}},
  );
}

export default function RazorpayCheckoutSuccess({
  loaderData,
}: {
  loaderData: CheckoutConfirmation;
}) {
  const published = useRef(false);
  const cleanupStarted = useRef(false);

  useEffect(() => {
    if (!loaderData.clearCart || cleanupStarted.current) return;
    cleanupStarted.current = true;
    void fetch('/api/cart-clear-after-checkout', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
      body: new URLSearchParams({intent: 'clear-cart'}),
      credentials: 'same-origin',
    })
      .then((response) => {
        if (!response.ok) return;
        return refreshPublishedCart();
      })
      .catch(() => undefined);
  }, [loaderData.clearCart]);

  useEffect(() => {
    if (!loaderData.metaPurchase || published.current) return;
    published.current = true;
    queueMetaPurchase(loaderData.metaPurchase);
  }, [loaderData.metaPurchase]);

  return (
    <main className="checkout-success-page">
      <section className="checkout-success-card" aria-labelledby="order-confirmed-title">
        <p className="eyebrow">Payment verified</p>
        <h1 id="order-confirmed-title">Order confirmed</h1>
        <p className="checkout-success-summary">
          Thank you. Your Shopify order <strong>{loaderData.shopifyOrderName}</strong> has
          been created successfully.
        </p>

        <dl className="checkout-success-references">
          <div>
            <dt>Shopify order number</dt>
            <dd>{loaderData.shopifyOrderName}</dd>
          </div>
          {loaderData.razorpayPaymentId && (
            <div>
              <dt>Razorpay payment ID</dt>
              <dd>{loaderData.razorpayPaymentId}</dd>
            </div>
          )}
        </dl>

        <p className="checkout-success-help">
          Keep these references for support. We will also send your order confirmation to
          the contact details provided at checkout.
        </p>
        <nav className="checkout-success-actions" aria-label="Order confirmation actions">
          <Link className="button primary" prefetch="none" to="/collections/all">
            Browse teas
          </Link>
          <Link className="button secondary" prefetch="none" to="/">
            Return home
          </Link>
          <Link className="text-link" prefetch="none" to="/pages/contact">
            Contact support
          </Link>
        </nav>

        <aside
          className="checkout-success-preferred-source"
          aria-labelledby="preferred-source-title"
        >
          <p className="eyebrow">Stay close to the source</p>
          <h2 id="preferred-source-title">There is more to tea than the cup</h2>
          <PreferredSourceButton />
          <p>
            Be the first to discover rare teas, brewing secrets, and untold stories from
            the gardens of Assam. Make Charaideo part of what you discover next.
          </p>
        </aside>
      </section>
    </main>
  );
}
