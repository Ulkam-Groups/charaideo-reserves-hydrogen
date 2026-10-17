import type {I18nBase} from '@shopify/hydrogen';

export function resolveStorefrontI18n(request: Request): I18nBase {
  const buyerCountry = request.headers
    .get('oxygen-buyer-country')
    ?.trim()
    .toUpperCase();

  return {
    language: 'EN',
    country:
      buyerCountry && /^[A-Z]{2}$/.test(buyerCountry) && buyerCountry !== 'XX'
        ? (buyerCountry as I18nBase['country'])
        : 'IN',
  };
}
