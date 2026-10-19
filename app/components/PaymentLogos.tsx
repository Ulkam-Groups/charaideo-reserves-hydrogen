import paypalLogo from '~/assets/payment-methods/paypal.svg?url';
import upiLogo from '~/assets/payment-methods/upi.svg?url';

const PAYMENT_LOGOS = [
  ['Visa', 'https://cdn.razorpay.com/card-networks/visa.svg'],
  ['Mastercard', 'https://cdn.razorpay.com/card-networks/mastercard.svg'],
  ['UPI', upiLogo],
  ['PayPal', paypalLogo],
];

export function PaymentLogos() {
  return (
    <div className="payment-logos cart-secure-logos" aria-label="Accepted payment methods">
      {PAYMENT_LOGOS.map(([name, source]) => (
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
