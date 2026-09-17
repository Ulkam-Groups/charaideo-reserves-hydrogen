type CheckoutResponse = {razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string};
type CheckoutInstance = {open: () => void};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => CheckoutInstance;
  }
}

let loading: Promise<void> | undefined;

function loadMagicScript() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/magic-checkout.js';
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay did not initialize'));
    script.onerror = () => reject(new Error('Razorpay could not load'));
    document.head.append(script);
  }).catch((error) => { loading = undefined; throw error; });
  return loading;
}

export async function openMagicCheckout(
  source: {source: 'cart'} | {source: 'product'; variantId: string},
  callbacks: {onSuccess: (message: string) => void; onError: (message: string) => void; onClose: () => void},
) {
  const response = await fetch('/api/razorpay-create', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(source),
  });
  const created = await response.json() as {key?: string; orderId?: string; error?: string};
  if (!response.ok || !created.key || !created.orderId) throw new Error(created.error || 'Checkout could not be started.');
  await loadMagicScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay could not load.');
  const checkout = new Razorpay({
    key: created.key,
    order_id: created.orderId,
    one_click_checkout: true,
    name: 'Charaideo Reserves',
    show_coupons: false,
    modal: {ondismiss: callbacks.onClose},
    handler: async (result: CheckoutResponse) => {
      try {
        const confirmation = await fetch('/api/razorpay-confirm', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(result),
        });
        const details = await confirmation.json() as {orderName?: string; error?: string};
        if (!confirmation.ok) throw new Error(details.error || 'Order confirmation is pending.');
        callbacks.onSuccess(details.orderName ? `Order ${details.orderName} is confirmed.` : (details.error || 'Order confirmation is pending.'));
      } catch (error) {
        callbacks.onError(error instanceof Error ? error.message : 'Order confirmation is pending.');
      }
    },
  });
  checkout.open();
}
