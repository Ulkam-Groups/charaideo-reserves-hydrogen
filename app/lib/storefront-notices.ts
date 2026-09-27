export type StorefrontNotice = {
  id: string;
  message: string;
  buttonLabel: string | null;
  buttonLink: string | null;
  displayOrder: number;
  tone: 'default' | 'success' | 'urgent' | 'warm' | 'light';
  state?: 'open' | 'opening-soon' | 'upcoming';
};

type MetaobjectField = {value?: string | null} | null;

export type StorefrontNoticeMetaobject = {
  id: string;
  message: MetaobjectField;
  buttonLabel: MetaobjectField;
  buttonLink: MetaobjectField;
  enabled: MetaobjectField;
  displayOrder: MetaobjectField;
  startsAt: MetaobjectField;
  endsAt: MetaobjectField;
  tone: MetaobjectField;
};

type ShopifyLink = {
  text?: unknown;
  url?: unknown;
};

export function parseStorefrontNotices(
  entries: StorefrontNoticeMetaobject[],
  now = new Date(),
): StorefrontNotice[] {
  const nowMs = now.getTime();

  return entries
    .flatMap((entry) => {
      const message = cleanText(entry.message?.value);
      if (!message || entry.enabled?.value !== 'true') return [];

      const startsAt = parseOptionalDate(entry.startsAt?.value);
      const endsAt = parseOptionalDate(entry.endsAt?.value);
      if (startsAt.invalid || endsAt.invalid) return [];
      if (startsAt.time !== null && nowMs < startsAt.time) return [];
      if (endsAt.time !== null && nowMs >= endsAt.time) return [];

      const link = parseShopifyLink(entry.buttonLink?.value);
      const configuredLabel = cleanText(entry.buttonLabel?.value);
      const linkLabel = cleanText(link?.text);

      return [{
        id: entry.id,
        message,
        buttonLabel: configuredLabel || linkLabel || (link ? 'Learn more →' : null),
        buttonLink: link?.url ?? null,
        displayOrder: parseDisplayOrder(entry.displayOrder?.value),
        tone: parseTone(entry.tone?.value),
      } satisfies StorefrontNotice];
    })
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    );
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseOptionalDate(value: string | null | undefined): {
  invalid: boolean;
  time: number | null;
} {
  const text = cleanText(value);
  if (!text) return {invalid: false, time: null};

  const time = Date.parse(text);
  return Number.isFinite(time)
    ? {invalid: false, time}
    : {invalid: true, time: null};
}

function parseDisplayOrder(value: string | null | undefined): number {
  const order = Number.parseInt(value ?? '', 10);
  return Number.isFinite(order) ? order : 100;
}

function parseShopifyLink(value: string | null | undefined): {
  text: string | null;
  url: string;
} | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as ShopifyLink;
    const url = cleanText(parsed.url);
    if (!url || !isSafeLink(url)) return null;
    return {text: cleanText(parsed.text), url};
  } catch {
    return null;
  }
}

function isSafeLink(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseTone(value: string | null | undefined): StorefrontNotice['tone'] {
  switch (cleanText(value)?.toLocaleLowerCase()) {
    case 'success':
    case 'open':
    case 'green':
      return 'success';
    case 'urgent':
    case 'alert':
    case 'red':
      return 'urgent';
    case 'warm':
    case 'gold':
    case 'amber':
      return 'warm';
    case 'light':
    case 'cream':
      return 'light';
    default:
      return 'default';
  }
}
