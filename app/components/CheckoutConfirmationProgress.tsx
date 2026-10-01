import {useCheckoutConfirmation} from '~/lib/checkout/checkout-progress';

export function CheckoutConfirmationProgress() {
  const active = useCheckoutConfirmation();

  if (!active) return null;

  return (
    <div className="checkout-confirmation-progress" aria-busy="true">
      <section role="status" aria-live="polite" aria-atomic="true">
        <span className="checkout-confirmation-spinner" aria-hidden="true" />
        <p className="eyebrow">Payment submitted</p>
        <h2>Confirming your order</h2>
        <p>
          Please keep this page open. Don&apos;t press Back or close this tab while we
          create your order.
        </p>
      </section>
    </div>
  );
}
