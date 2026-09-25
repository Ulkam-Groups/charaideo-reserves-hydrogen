export type RazorpayShippingAddress = {
  id: string;
  zipcode: string;
  state_code?: string;
  country: string;
};

function nonNegativeInteger(value: string | undefined, name: string): number {
  if (!value || !/^\d+$/.test(value)) throw new Error(`${name} is not configured`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} is invalid`);
  return parsed;
}

export function buildRazorpayShippingResponse(
  addresses: RazorpayShippingAddress[],
  env: Env,
) {
  const shippingFee = nonNegativeInteger(
    env.RAZORPAY_SHIPPING_FEE_PAISE,
    'RAZORPAY_SHIPPING_FEE_PAISE',
  );
  const codEnabled = env.RAZORPAY_COD_ENABLED?.trim().toLowerCase() === 'true';
  const codFee = codEnabled
    ? nonNegativeInteger(env.RAZORPAY_COD_FEE_PAISE ?? '0', 'RAZORPAY_COD_FEE_PAISE')
    : 0;

  return {
    addresses: addresses.map((address) => {
      const serviceable = address.country === 'IN' && /^\d{6}$/.test(address.zipcode);
      return {
        ...address,
        shipping_methods: [
          {
            id: 'standard',
            description: 'Standard delivery',
            name: 'Standard delivery',
            serviceable,
            shipping_fee: shippingFee,
            cod: serviceable && codEnabled,
            cod_fee: serviceable && codEnabled ? codFee : 0,
          },
        ],
      };
    }),
  };
}

export function parseRazorpayShippingAddresses(
  value: unknown,
): RazorpayShippingAddress[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null;
  const addresses = value.map((address) => {
    if (!address || typeof address !== 'object') return null;
    const {id, zipcode, state_code, country} = address as Record<string, unknown>;
    if (
      typeof id !== 'string' ||
      typeof zipcode !== 'string' ||
      typeof country !== 'string' ||
      (state_code !== undefined && typeof state_code !== 'string')
    ) {
      return null;
    }
    return {
      id: id.slice(0, 100),
      zipcode: zipcode.trim(),
      ...(state_code ? {state_code: state_code.slice(0, 10)} : {}),
      country: country.toUpperCase(),
    };
  });
  return addresses.some((address) => address === null)
    ? null
    : (addresses as RazorpayShippingAddress[]);
}
