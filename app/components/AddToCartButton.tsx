import {useEffect, useRef, useState} from 'react';
import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
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
}: {
  children: React.ReactNode;
  disabled?: boolean;
  fetcher: FetcherWithComponents<any>;
  onClick?: () => void;
}) {
  const [added, setAdded] = useState(false);
  const wasBusy = useRef(false);
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    if (fetcher.data?.errors?.length > 0) return;
    setAdded(true);
    const timer = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timer);
  }, [busy, fetcher.data]);

  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={disabled || busy}
      data-state={busy ? 'busy' : added ? 'added' : 'idle'}
    >
      {busy ? 'Adding...' : added ? 'Added ?' : children}
    </button>
  );
}
