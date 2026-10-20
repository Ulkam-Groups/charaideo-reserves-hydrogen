import paypalLogo from '~/assets/payment-methods/paypal.svg?url';
import upiLogo from '~/assets/payment-methods/upi.svg?url';

const PAYMENT_LOGOS = [
  ['Visa', 'https://cdn.razorpay.com/card-networks/visa.svg'],
  ['Mastercard', 'https://cdn.razorpay.com/card-networks/mastercard.svg'],
  ['UPI', upiLogo],
  ['PayPal', paypalLogo],
] as const;

type PaymentMethod = (typeof PAYMENT_LOGOS)[number][0];

export function PaymentLogos({methods}: {methods?: PaymentMethod[]}) {
  const logos = methods
    ? methods.flatMap((method) =>
        PAYMENT_LOGOS.filter(([name]) => name === method),
      )
    : PAYMENT_LOGOS;

  return (
    <div className="payment-logos cart-secure-logos" aria-label="Accepted payment methods">
      {logos.map(([name, source]) => (
        <img
          key={name}
          src={source}
          alt={name}
          title={name}
          width={18}
          height={18}
          loading="lazy"
        />
      ))}
    </div>
  );
}
