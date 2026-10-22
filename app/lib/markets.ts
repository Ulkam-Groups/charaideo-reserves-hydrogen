import type {I18nBase} from '@shopify/hydrogen';

/** India is the only launched market; unmatched visitors use this backup context. */
export const DEFAULT_STOREFRONT_MARKET = {
  country: 'IN',
  language: 'EN',
} satisfies I18nBase;

const MARKET_COOKIE = 'cr_market';

export type StorefrontMarket = {
  isoCode: string;
  name: string;
  currency: {isoCode: string; symbol: string};
};

export function isCheckoutCountrySupported(country: I18nBase['country']) {
  return country === 'IN';
}

export function isSelectableMarket(country: string): country is I18nBase['country'] {
  const normalized = country.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) && !['XX', 'ZZ'].includes(normalized);
}

function selectedMarket(request: Request) {
  const value = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === MARKET_COOKIE)?.[1]
    ?.toUpperCase();

  return value && isSelectableMarket(value)
    ? (value as I18nBase['country'])
    : null;
}

export function marketCookie(country: string, secure = true) {
  if (!isSelectableMarket(country)) throw new Error('Unsupported storefront market');
  return `${MARKET_COOKIE}=${country.toUpperCase()}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Resolve the buyer's initial Storefront API context from Oxygen's trusted
 * edge geolocation. Shopify Markets remains authoritative for whether that
 * country is enabled and which presentment currency and price it receives.
 */
export function resolveStorefrontI18n(request: Request): I18nBase {
  const selectedCountry = selectedMarket(request);
  if (selectedCountry) return {country: selectedCountry, language: 'EN'};

  const hostname = new URL(request.url).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return DEFAULT_STOREFRONT_MARKET;
  }

  const buyerCountry = request.headers
    .get('oxygen-buyer-country')
    ?.trim()
    .toUpperCase();

  return {
    language: 'EN',
    country:
      buyerCountry && /^[A-Z]{2}$/.test(buyerCountry) && buyerCountry !== 'XX'
        ? (buyerCountry as I18nBase['country'])
        : DEFAULT_STOREFRONT_MARKET.country,
  };
}
