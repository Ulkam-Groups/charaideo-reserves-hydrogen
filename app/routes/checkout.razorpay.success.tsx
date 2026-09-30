import {
  Link,
  redirect,
  useRevalidator,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from 'react-router';
import {useEffect, useState} from 'react';
import {findShopifyOrder} from '~/lib/checkout/providers/razorpay/razorpay-order.server';
import checkoutSuccessStyles from '~/styles/checkout-success.css?url';

export const links = () => [{rel: 'stylesheet', href: checkoutSuccessStyles}];

export const meta: MetaFunction = () => [
  {title: 'Order confirmed | Charaideo Reserves™'},
  {
    name: 'description',
    content: 'Your Charaideo Reserves order has been confirmed.',
  },
];

export const headers: HeadersFunction = () => ({
  'Cache-Control': 'no-store, private',
});

export async function loader({context}: LoaderFunctionArgs) {
  const result = context.session.get('razorpayPaymentVerified') as unknown;
  if (
    !result ||
    typeof result !== 'object' ||
    typeof (result as {razorpayOrderId?: unknown}).razorpayOrderId !== 'string'
  ) {
    throw redirect('/cart');
  }
  const verified = result as {
    razorpayOrderId: string;
    razorpayPaymentId?: unknown;
    shopifyOrderName?: unknown;
    paymentMethod?: unknown;
  };
  const razorpayOrderId = /^order_[A-Za-z0-9]+$/.test(verified.razorpayOrderId)
    ? verified.razorpayOrderId
    : null;
  if (!razorpayOrderId) throw redirect('/cart');
  const razorpayPaymentId =
    typeof verified.razorpayPaymentId === 'string' &&
    /^pay_[A-Za-z0-9]+$/.test(verified.razorpayPaymentId)
      ? verified.razorpayPaymentId
      : null;
  const paymentMethod = verified.paymentMethod === 'cod' ? 'cod' : 'prepaid';
  let orderName =
    typeof verified.shopifyOrderName === 'string' ? verified.shopifyOrderName : null;
  if (!orderName) {
    try {
      orderName = (await findShopifyOrder(context.env, razorpayOrderId))?.name ?? null;
    } catch (error) {
      context.monitor?.failure(
        'checkout.razorpay.confirmation_lookup.failure',
        {},
        error,
      );
    }
  }
  if (orderName) context.session.unset('razorpayPaymentVerified');
  return {orderName, paymentMethod, razorpayOrderId, razorpayPaymentId};
}

export default function RazorpayCheckoutSuccess({
  loaderData,
}: {
  loaderData: {
    orderName: string | null;
    paymentMethod: 'prepaid' | 'cod';
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
  };
}) {
  const revalidator = useRevalidator();
  const isPending = !loaderData.orderName;
  const [pollCount, setPollCount] = useState(0);
  const confirmationDelayed = isPending && pollCount >= 30;
  const isCod = loaderData.paymentMethod === 'cod';

  useEffect(() => {
    if (!isPending || pollCount >= 30) return;
    const timeout = window.setTimeout(
      () => {
        setPollCount((count) => count + 1);
        revalidator.revalidate();
      },
      pollCount < 10 ? 2_000 : 5_000,
    );
    return () => window.clearTimeout(timeout);
  }, [isPending, pollCount, revalidator]);

  return (
    <main className="checkout-success-page">
      <section className="checkout-success-hero" aria-labelledby="order-confirmed-title">
        <div className="checkout-success-layout">
          <div className="checkout-success-copy">
            <p className="checkout-success-eyebrow">
              <span aria-hidden="true" />
              {isCod ? 'Cash on delivery' : 'Payment complete'}
            </p>
            <h1 id="order-confirmed-title">
              {isPending
                ? isCod
                  ? 'Order received'
                  : 'Payment confirmed'
                : 'Your reserve'}
              <br />
              <em>{isPending ? 'Order is processing.' : 'is confirmed.'}</em>
            </h1>
            <p className="checkout-success-intro">
              {isCod
                ? isPending
                  ? confirmationDelayed
                    ? 'Your COD order was received, but confirmation is taking longer than expected. Please contact us before placing another order.'
                    : 'Your COD order was received. We are finalising it now. You can safely leave this page; confirmation will follow.'
                  : 'Thank you for choosing a tea kept in reserve. Your order is confirmed and payment will be collected on delivery.'
                : isPending
                  ? confirmationDelayed
                    ? 'Your payment is secure, but order confirmation is taking longer than expected. You can contact us for help without paying again.'
                    : 'Your payment is secure. We are creating your order now. You can safely leave this page; confirmation will follow.'
                  : 'Thank you for choosing a tea kept in reserve. Your payment has been verified and your order is now with us.'}
            </p>

            <div className="checkout-success-actions">
              <Link
                className="checkout-success-button checkout-success-button-primary"
                prefetch="intent"
                to="/reserve-list"
              >
                Explore the tea library
              </Link>
              <Link
                className="checkout-success-button checkout-success-button-secondary"
                prefetch="intent"
                to="/"
              >
                Return home
              </Link>
            </div>

            <p className="checkout-success-proof">
              Single estate <span aria-hidden="true">·</span> Single harvest{' '}
              <span aria-hidden="true">·</span> Fully traceable
            </p>
          </div>

          <aside
            className="checkout-success-card"
            aria-label="Order confirmation details"
            aria-live="polite"
          >
            <div className="checkout-success-seal" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18.5" />
                <path d="m12.5 20.5 5 5 10-11" />
              </svg>
            </div>

            <p className="checkout-success-card-label">
              {isPending ? 'Razorpay order ID' : 'Shopify order reference'}
            </p>
            <p className="checkout-success-order-name">
              {loaderData.orderName ?? loaderData.razorpayOrderId}
            </p>
            <dl className="checkout-success-identifiers">
              {!isPending && (
                <div>
                  <dt>Razorpay order ID</dt>
                  <dd>{loaderData.razorpayOrderId}</dd>
                </div>
              )}
              {loaderData.razorpayPaymentId && (
                <div>
                  <dt>Payment ID</dt>
                  <dd>{loaderData.razorpayPaymentId}</dd>
                </div>
              )}
            </dl>
            <p className="checkout-success-card-note">
              {isPending
                ? confirmationDelayed
                  ? 'Please do not pay again. Contact us if confirmation does not arrive shortly.'
                  : 'Please do not place or pay for this order again while confirmation completes.'
                : 'Keep this reference for any questions about your order.'}
            </p>

            <ol className="checkout-success-progress">
              <li className="is-complete">
                <span className="checkout-success-progress-marker" aria-hidden="true" />
                <span>
                  <strong>
                    {isCod ? 'Cash on delivery selected' : 'Payment verified'}
                  </strong>
                  <small>
                    {isCod ? 'Payment due on delivery' : 'Completed securely'}
                  </small>
                </span>
              </li>
              <li className={isPending ? undefined : 'is-complete'}>
                <span className="checkout-success-progress-marker" aria-hidden="true" />
                <span>
                  <strong>{isPending ? 'Creating order' : 'Order placed'}</strong>
                  <small>
                    {isPending
                      ? 'Confirmation is in progress'
                      : `${loaderData.orderName} is confirmed`}
                  </small>
                </span>
              </li>
              <li>
                <span className="checkout-success-progress-marker" aria-hidden="true" />
                <span>
                  <strong>Prepared for dispatch</strong>
                  <small>Updates will follow shortly</small>
                </span>
              </li>
            </ol>

            <p className="checkout-success-payment-note">
              <span aria-hidden="true" />{' '}
              {isCod ? 'Cash on delivery via Razorpay' : 'Paid securely with Razorpay'}
            </p>
          </aside>
        </div>
      </section>

      <section className="checkout-success-next" aria-labelledby="what-happens-next">
        <div>
          <p className="checkout-success-section-number">01</p>
          <h2 id="what-happens-next">What happens next</h2>
        </div>
        <div className="checkout-success-next-copy">
          <p>
            We will prepare your reserve for dispatch and send order updates to the
            contact details used at checkout.
          </p>
          <p>
            Need help?{' '}
            {loaderData.orderName && (
              <>
                Mention <strong>{loaderData.orderName}</strong> when you{' '}
              </>
            )}
            <Link prefetch="intent" to="/pages/contact">
              contact us
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
