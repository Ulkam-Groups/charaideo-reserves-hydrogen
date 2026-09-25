import {useEffect} from 'react';

export const CHECKOUT_ERROR_EVENT = 'checkout:error';

export function dispatchCheckoutError(message: string) {
  window.dispatchEvent(
    new CustomEvent(CHECKOUT_ERROR_EVENT, {detail: {message}}),
  );
}

export function useCheckoutError(setError: (message: string) => void) {
  useEffect(() => {
    const handleError = (event: Event) => {
      const message = (event as CustomEvent<{message?: unknown}>).detail?.message;
      if (typeof message === 'string') setError(message);
    };
    window.addEventListener(CHECKOUT_ERROR_EVENT, handleError);
    return () => window.removeEventListener(CHECKOUT_ERROR_EVENT, handleError);
  }, [setError]);
}
