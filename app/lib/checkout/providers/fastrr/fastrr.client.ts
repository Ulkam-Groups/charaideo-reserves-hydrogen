import {recordFastrrLaunch} from '../../../monitoring-signals.ts';
import type {FastrrCheckoutInput} from './fastrr.ts';
import {FASTRR_ASSETS} from './fastrr.config.ts';

export type {FastrrCheckoutInput} from './fastrr.ts';

declare global {
  interface Window {
    shiprocketCheckoutEvents?: {
      buyDirect: (input: FastrrCheckoutInput) => void;
    };
  }
}

const FASTRR_SCRIPT_ID = 'fastrr-checkout-script';
const FASTRR_STYLESHEET_ID = 'fastrr-checkout-stylesheet';
const FASTRR_LOAD_TIMEOUT_MS = 8_000;
let fastrrLoadPromise: Promise<boolean> | null = null;

function loadFastrrCheckout() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.shiprocketCheckoutEvents?.buyDirect) return Promise.resolve(true);
  if (fastrrLoadPromise) return fastrrLoadPromise;

  fastrrLoadPromise = new Promise<boolean>((resolve) => {
    if (!document.getElementById(FASTRR_STYLESHEET_ID)) {
      const link = document.createElement('link');
      link.id = FASTRR_STYLESHEET_ID;
      link.rel = 'stylesheet';
      link.href = FASTRR_ASSETS.stylesheet;
      document.head.appendChild(link);
    }

    const existing = document.getElementById(
      FASTRR_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    let settled = false;
    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(available);
    };
    const timeout = window.setTimeout(() => finish(false), FASTRR_LOAD_TIMEOUT_MS);

    script.addEventListener(
      'load',
      () => finish(Boolean(window.shiprocketCheckoutEvents?.buyDirect)),
      {once: true},
    );
    script.addEventListener('error', () => finish(false), {once: true});
    if (!existing) {
      script.id = FASTRR_SCRIPT_ID;
      script.async = true;
      script.src = FASTRR_ASSETS.script;
      document.head.appendChild(script);
    }
  });

  return fastrrLoadPromise;
}

export function warmFastrrCheckout() {
  return loadFastrrCheckout();
}

export async function startFastrrCheckout(
  input: FastrrCheckoutInput,
): Promise<boolean> {
  if (!(await loadFastrrCheckout())) {
    recordFastrrLaunch(input.type, 'missing');
    return false;
  }
  const checkoutEvents = window.shiprocketCheckoutEvents;
  if (!checkoutEvents?.buyDirect) {
    recordFastrrLaunch(input.type, 'missing');
    return false;
  }
  try {
    checkoutEvents.buyDirect(input);
    recordFastrrLaunch(input.type, 'requested');
    return true;
  } catch (error) {
    recordFastrrLaunch(input.type, 'threw', error);
    return false;
  }
}
