type AnalyticsEnvironment = {
  PUBLIC_CHECKOUT_DOMAIN?: string;
  PUBLIC_STOREFRONT_API_TOKEN?: string;
};

export function buildAnalyticsConsent(env: AnalyticsEnvironment) {
  return {
    checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN ?? '',
    storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN ?? '',
    withPrivacyBanner: true,
  };
}
