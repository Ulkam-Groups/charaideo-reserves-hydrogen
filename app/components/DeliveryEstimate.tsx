import {useState, type FormEvent} from 'react';

type DeliveryResult = {
  serviceable: boolean;
  courierName: string | null;
  estimatedDeliveryDate: string | null;
  estimatedDays: number | null;
};

export function DeliveryEstimate() {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function checkDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setError('');

    if (!/^\d{6}$/.test(pincode)) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        `/api/shipping-estimate?pincode=${encodeURIComponent(pincode)}`,
        {headers: {Accept: 'application/json'}},
      );
      const payload = (await response.json()) as DeliveryResult & {
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error || 'Could not check delivery right now.');
        return;
      }

      setResult(payload);
    } catch {
      setError('Could not check delivery right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="delivery-estimate" aria-labelledby="delivery-estimate-title">
      <div className="delivery-estimate-heading">
        <h2 id="delivery-estimate-title">Check delivery</h2>
        <p>Estimated arrival to your pincode</p>
      </div>
      <form className="delivery-estimate-form" onSubmit={checkDelivery}>
        <label className="visually-hidden" htmlFor="delivery-pincode">
          Delivery pincode
        </label>
        <input
          id="delivery-pincode"
          name="pincode"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="Enter 6-digit pincode"
          value={pincode}
          onChange={(event) => {
            setPincode(event.target.value.replace(/\D/g, '').slice(0, 6));
            setResult(null);
            setError('');
          }}
        />
        <button type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Check'}
        </button>
      </form>
      <div className="delivery-estimate-result" aria-live="polite" aria-atomic="true">
        {error && <p className="delivery-estimate-error">{error}</p>}
        {result?.serviceable && (
          <p className="delivery-estimate-success">
            <span aria-hidden="true">✓</span>
            {deliveryMessage(result)}
          </p>
        )}
        {result?.serviceable === false && (
          <p className="delivery-estimate-error">
            Delivery is not currently available to this pincode.
          </p>
        )}
      </div>
      {result?.serviceable && (
        <p className="delivery-estimate-note">
          Courier estimate only; the final delivery date may change after dispatch.
        </p>
      )}
    </section>
  );
}

function deliveryMessage(result: DeliveryResult) {
  if (result.estimatedDeliveryDate) {
    return `Estimated delivery by ${formatDate(result.estimatedDeliveryDate)}.`;
  }
  if (result.estimatedDays != null) {
    return `Estimated delivery in ${result.estimatedDays} ${
      result.estimatedDays === 1 ? 'day' : 'days'
    }.`;
  }
  return 'Delivery is available to this pincode.';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
