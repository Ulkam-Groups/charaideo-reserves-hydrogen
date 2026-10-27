import {data, type ActionFunctionArgs} from 'react-router';
import {clearCartAfterSuccessfulCheckout} from '~/lib/checkout/cart-clear.server';
import {readProtectedForm} from '~/lib/protected-write.server';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const form = await readProtectedForm(request, {
      methods: ['POST'],
      maxBytes: 128,
    });
    if (form instanceof Response) return form;

    const pending = context.session.get('razorpayCartClearPending') as unknown;
    if (!pending || typeof pending !== 'object') {
      return data({cleared: false}, {status: 409});
    }

    const cleared = await clearCartAfterSuccessfulCheckout(context.cart);
    if (cleared) context.session.unset('razorpayCartClearPending');
    return data({cleared}, {status: cleared ? 200 : 503});
  } catch {
    // Cleanup is secondary to the confirmed order and must never affect its UI.
    return data(
      {cleared: false},
      {headers: {'Cache-Control': 'private, no-store'}},
    );
  }
}
