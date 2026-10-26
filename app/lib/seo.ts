export const SITE_URL = 'https://www.teareserves.com';
export const SITE_NAME = 'Charaideo Reserves';
export const PARENT_BRAND_NAME = 'Tea Reserves of India';
export const BRAND_ENDORSEMENT = `From the House of ${PARENT_BRAND_NAME}.`;

export function canonicalUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, SITE_URL).toString();
}

export function metaDescription(value: string | null | undefined, fallback: string) {
  const description = value?.replace(/\s+/g, ' ').trim() || fallback;
  return description.length <= 160
    ? description
    : `${description.slice(0, 157).trimEnd()}…`;
}

export function brandedMetaDescription(
  value: string | null | undefined,
  fallback: string,
) {
  const description = value?.replace(/\s+/g, ' ').trim() || fallback;
  if (/tea reserves of india/i.test(description)) {
    return metaDescription(description, fallback);
  }

  const availableLength = 160 - BRAND_ENDORSEMENT.length - 1;
  const lead =
    description.length <= availableLength
      ? description
      : `${description.slice(0, availableLength - 1).trimEnd()}…`;

  return `${lead} ${BRAND_ENDORSEMENT}`;
}

export function breadcrumbJsonLd(items: Array<{name: string; path: string}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: 'Charaideo Reserves India',
  url: `${SITE_URL}/`,
  slogan: 'Authentic luxury single-origin Assam tea',
  knowsAbout: [
    'Assam tea',
    'Indian tea',
    'single-origin tea',
    'luxury tea',
    'Assam tea estates',
  ],
  parentOrganization: {
    '@id': `${SITE_URL}/#tea-reserves-of-india`,
  },
};

export const parentOrganizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#tea-reserves-of-india`,
  name: PARENT_BRAND_NAME,
  alternateName: 'Tea Reserves',
  url: `${SITE_URL}/`,
  slogan: 'The House of authentic Indian tea reserves',
  subOrganization: {
    '@id': `${SITE_URL}/#organization`,
  },
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  publisher: {'@id': `${SITE_URL}/#organization`},
};
