import type {CountryCode, LanguageCode} from '@shopify/hydrogen/storefront-api-types';

export const LOCALES = {
  'en-in': {prefix: '', country: 'IN', language: 'EN', languageTag: 'en-IN', label: 'India', flag: '🇮🇳'},
  'en-us': {prefix: 'en-us', country: 'US', language: 'EN', languageTag: 'en-US', label: 'United States — English', flag: '🇺🇸'},
  'en-ca': {prefix: 'en-ca', country: 'CA', language: 'EN', languageTag: 'en-CA', label: 'Canada — English', flag: '🇨🇦'},
  'fr-ca': {prefix: 'fr-ca', country: 'CA', language: 'FR', languageTag: 'fr-CA', label: 'Canada — Français', flag: '🇨🇦'},
} as const;

export type LocaleKey = keyof typeof LOCALES;
export type StorefrontLocale = (typeof LOCALES)[LocaleKey] & {key: LocaleKey};

const PREFIX_TO_KEY = new Map<string, LocaleKey>(
  Object.entries(LOCALES)
    .filter(([, locale]) => locale.prefix)
    .map(([key, locale]) => [locale.prefix, key as LocaleKey]),
);

export function localeFromRequest(
  request: Request,
  preferredLocale?: unknown,
): StorefrontLocale {
  const firstSegment = new URL(request.url).pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  const preferredKey =
    typeof preferredLocale === 'string' && preferredLocale in LOCALES
      ? (preferredLocale as LocaleKey)
      : undefined;
  const key = (firstSegment && PREFIX_TO_KEY.get(firstSegment)) || preferredKey || 'en-in';
  return {...LOCALES[key], key};
}

export function isSupportedLocalePrefix(value: string | undefined) {
  return Boolean(value && PREFIX_TO_KEY.has(value.toLowerCase()));
}

export function localeKeyFromCountryLanguage(country: string, language?: string): LocaleKey {
  const normalizedCountry = country.toUpperCase();
  const normalizedLanguage = language?.toLowerCase();
  if (normalizedCountry === 'CA') return normalizedLanguage?.startsWith('fr') ? 'fr-ca' : 'en-ca';
  if (normalizedCountry === 'US') return 'en-us';
  return 'en-in';
}

export function detectSuggestedLocale(request: Request): LocaleKey {
  const url = new URL(request.url);
  const country = url.searchParams.get('country') || request.headers.get('cf-ipcountry') || request.headers.get('x-country-code') || '';
  return localeKeyFromCountryLanguage(country, request.headers.get('accept-language') || '');
}

export function switchLocalePath(pathAndSearch: string, destination: LocaleKey) {
  const url = new URL(pathAndSearch, 'https://locale.invalid');
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length && isSupportedLocalePrefix(segments[0])) segments.shift();
  const prefix = LOCALES[destination].prefix;
  url.pathname = `/${[prefix, ...segments].filter(Boolean).join('/')}`;
  for (const key of ['country', 'language', 'locale', 'market']) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function storefrontI18n(locale: StorefrontLocale): {country: CountryCode; language: LanguageCode} {
  return {country: locale.country, language: locale.language};
}
