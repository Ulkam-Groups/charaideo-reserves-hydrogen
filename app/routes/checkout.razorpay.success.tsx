import {redirect, type LoaderFunctionArgs} from 'react-router';

export function loader({context}: LoaderFunctionArgs) {
  const result = context.session.get('razorpayPaymentVerified') as unknown;
  if (
    !result ||
    typeof result !== 'object' ||
    typeof (result as {shopifyOrderName?: unknown}).shopifyOrderName !== 'string'
  ) {
    throw redirect('/cart');
  }
  context.session.unset('razorpayPaymentVerified');
  return {orderName: (result as {shopifyOrderName: string}).shopifyOrderName};
}

export default function RazorpayCheckoutSuccess({loaderData}: {loaderData: {orderName: string}}) {
  return (
    <main className="container">
      <h1>Order confirmed</h1>
      <p>
        Payment was verified and Shopify order {loaderData.orderName} was created
        successfully.
      </p>
    </main>
  );
}
