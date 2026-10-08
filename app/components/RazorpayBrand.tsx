import razorpayLogo from '~/assets/razorpay-logo-white.png';

export function RazorpayBrand({wordmark = false}: {wordmark?: boolean}) {
  return (
    <span
      className={`razorpay-brand${wordmark ? ' razorpay-brand--wordmark' : ''}`}
      aria-hidden="true"
    >
      <span className="razorpay-brand-crop">
        <img src={razorpayLogo} alt="" />
      </span>
    </span>
  );
}
