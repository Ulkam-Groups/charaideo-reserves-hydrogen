import {useEffect, useRef, useState} from 'react';
import {type FetcherWithComponents} from 'react-router';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {publishCart} from '~/lib/cart-sync';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  mobileSwipe = false,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  mobileSwipe?: boolean;
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
            mobileSwipe={mobileSwipe}
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
  mobileSwipe,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  fetcher: FetcherWithComponents<any>;
  mobileSwipe: boolean;
  onClick?: () => void;
}) {
  const [added, setAdded] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const suppressNextClick = useRef(false);
  const wasBusy = useRef(false);
  const busy = fetcher.state !== 'idle';

  const resetSwipe = () => {
    swipeStart.current = null;
    setSwipeOffset(0);
  };

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    if (fetcher.data?.errors?.length > 0) return;
    publishCart(fetcher.data?.cart);
    setAdded(true);
    const timer = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timer);
  }, [busy, fetcher.data]);

  return (
    <>
      <button
        type="submit"
        className={mobileSwipe ? 'add-to-cart-swipe' : undefined}
        onClick={(event) => {
          if (suppressNextClick.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.();
        }}
        onPointerDown={(event) => {
          if (!mobileSwipe || event.pointerType !== 'touch') return;
          swipeStart.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (swipeStart.current === null) return;
          setSwipeOffset(
            Math.min(96, Math.max(0, event.clientX - swipeStart.current)),
          );
        }}
        onPointerCancel={resetSwipe}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const swiped = event.clientX - swipeStart.current >= 64;
          resetSwipe();
          if (!swiped) return;

          suppressNextClick.current = true;
          onClick?.();
          event.currentTarget.form?.requestSubmit(event.currentTarget);
          window.setTimeout(() => {
            suppressNextClick.current = false;
          }, 0);
        }}
        disabled={disabled || busy}
        data-state={busy ? 'busy' : added ? 'added' : 'idle'}
        style={
          mobileSwipe
            ? ({'--add-cart-swipe-offset': `${swipeOffset}px`} as React.CSSProperties)
            : undefined
        }
      >
        {mobileSwipe && (
          <span className="add-to-cart-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7.5 18a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm9 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
              <path d="M13 13V9m-2 2h4M2 3l.26.09c1.3.46 1.95.69 2.33 1.23.37.55.37 1.27.37 2.72v2.72c0 2.94.06 3.91.93 4.83.86.91 2.26.91 5.05.91H12m4.24 0c1.56 0 2.34 0 2.89-.45.56-.45.71-1.21 1.03-2.74l.5-2.43c.34-1.74.52-2.61.07-3.18-.44-.58-1.96-.58-3.64-.58h-6.07m-6.06 0H7" />
            </svg>
          </span>
        )}
        <span className="add-to-cart-label">
          {busy ? 'Adding...' : added ? 'Added ✓' : children}
        </span>
      </button>
    </>
  );
}
