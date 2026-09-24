function unsupported(): never {
  throw new Error(
    'Razorpay Node crypto helpers are unavailable in Oxygen; use Web Crypto verification',
  );
}

// razorpay-node loads these helpers eagerly even though order/payment API calls
// do not use them. Keep accidental use explicit instead of silently weakening
// cryptographic verification in the worker runtime.
export const createHmac = unsupported;
export const randomBytes = unsupported;
export const createCipheriv = unsupported;

export default {createHmac, randomBytes, createCipheriv};
