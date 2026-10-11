import {useEffect, useRef, useState} from 'react';
import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {publishCart} from '~/lib/cart-sync';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  checkout = false,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  checkout?: boolean;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <AddToCartSubmit
            fetcher={fetcher}
            disabled={disabled}
            onClick={onClick}
            checkout={checkout}
          >
            {children}
          </AddToCartSubmit>
          {fetcher.data?.errors?.length > 0 && <p role="alert">We could not add this item. Please try again.</p>}
        </>
      )}
    </CartForm>
  );
}

function AddToCartSubmit({
  children,
  disabled,
  fetcher,
  onClick,
  checkout,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  fetcher: FetcherWithComponents<any>;
  onClick?: () => void;
  checkout: boolean;
}) {
  const [added, setAdded] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const wasBusy = useRef(false);
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setCheckoutError(false);
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    if (fetcher.data?.errors?.length > 0) return;
    publishCart(fetcher.data?.cart);
    if (checkout) {
      const checkoutUrl = fetcher.data?.cart?.checkoutUrl;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
      } else {
        setCheckoutError(true);
      }
      return;
    }
    setAdded(true);
    const timer = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timer);
  }, [busy, checkout, fetcher.data]);

  return (
    <>
      <button
        type="submit"
        onClick={onClick}
        disabled={disabled || busy}
        data-state={busy ? 'busy' : added ? 'added' : 'idle'}
      >
        {busy ? (checkout ? 'Preparing checkout...' : 'Adding...') : added ? 'Added ✓' : children}
      </button>
      {checkoutError && (
        <p role="alert">Checkout is temporarily unavailable. Please try again.</p>
      )}
    </>
  );
}
