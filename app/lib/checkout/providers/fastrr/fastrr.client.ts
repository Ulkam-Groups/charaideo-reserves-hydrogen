import {recordFastrrLaunch} from '../../../monitoring-signals.ts';
import type {FastrrCheckoutInput} from './fastrr.ts';

export type {FastrrCheckoutInput} from './fastrr.ts';

declare global {
  interface Window {
    shiprocketCheckoutEvents?: {
      buyDirect: (input: FastrrCheckoutInput) => void;
    };
  }
}

export function startFastrrCheckout(input: FastrrCheckoutInput): boolean {
  if (
    typeof window === 'undefined' ||
    !window.shiprocketCheckoutEvents?.buyDirect
  ) {
    recordFastrrLaunch(input.type, 'missing');
    return false;
  }
  try {
    window.shiprocketCheckoutEvents.buyDirect(input);
    recordFastrrLaunch(input.type, 'requested');
    return true;
  } catch (error) {
    recordFastrrLaunch(input.type, 'threw', error);
    return false;
  }
}
