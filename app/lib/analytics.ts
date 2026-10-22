import type {I18nBase} from '@shopify/hydrogen';
import {DEFAULT_STOREFRONT_MARKET} from './markets.ts';

type AnalyticsEnvironment = {
  PUBLIC_CHECKOUT_DOMAIN?: string;
  PUBLIC_STOREFRONT_API_TOKEN?: string;
};

export function buildAnalyticsConsent(
  env: AnalyticsEnvironment,
  market: I18nBase = DEFAULT_STOREFRONT_MARKET,
) {
  return {
    checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN ?? '',
    storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN ?? '',
    withPrivacyBanner: true,
    country: market.country,
    language: market.language,
  };
}
