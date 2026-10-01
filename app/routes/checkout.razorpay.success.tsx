import {data, Link, redirect, type LoaderFunctionArgs} from 'react-router';

type CheckoutConfirmation = {
  shopifyOrderName: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
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
    },
    {headers: {'Cache-Control': 'private, no-store'}},
  );
}

export default function RazorpayCheckoutSuccess({
  loaderData,
}: {
  loaderData: CheckoutConfirmation;
}) {
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
          {loaderData.razorpayOrderId && (
            <div>
              <dt>Razorpay order ID</dt>
              <dd>{loaderData.razorpayOrderId}</dd>
            </div>
          )}
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
          <Link className="button primary" prefetch="intent" to="/collections/all">
            Browse teas <span aria-hidden="true">&rarr;</span>
          </Link>
          <Link className="button secondary" prefetch="intent" to="/">
            Return home
          </Link>
          <Link className="text-link" prefetch="intent" to="/pages/contact">
            Contact support
          </Link>
        </nav>
      </section>
    </main>
  );
}
