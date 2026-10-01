import {useEffect, useState} from 'react';

export const CHECKOUT_CONFIRMATION_EVENT = 'checkout:confirmation';

export function dispatchCheckoutConfirmation(active: boolean) {
  window.dispatchEvent(new CustomEvent(CHECKOUT_CONFIRMATION_EVENT, {detail: {active}}));
}

export function useCheckoutConfirmation() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleConfirmation = (event: Event) => {
      const nextActive = (event as CustomEvent<{active?: unknown}>).detail?.active;
      if (typeof nextActive === 'boolean') setActive(nextActive);
    };

    window.addEventListener(CHECKOUT_CONFIRMATION_EVENT, handleConfirmation);
    return () =>
      window.removeEventListener(CHECKOUT_CONFIRMATION_EVENT, handleConfirmation);
  }, []);

  return active;
}
