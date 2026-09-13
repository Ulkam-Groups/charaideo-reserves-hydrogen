import {Parser} from 'htmlparser2';

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
  'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe', 'img', 'li',
  'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u',
  'ul',
]);

const VOID_TAGS = new Set(['br', 'col', 'hr', 'img']);
const ACTIVE_CONTENT_TAGS = new Set([
  'applet', 'embed', 'object', 'script', 'style', 'template', 'textarea',
]);
const GLOBAL_ATTRIBUTES = new Set([
  'aria-hidden', 'aria-label', 'class', 'id', 'title',
]);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'name', 'rel', 'target']),
  iframe: new Set(['allow', 'allowfullscreen', 'height', 'src', 'title', 'width']),
  img: new Set(['alt', 'height', 'loading', 'sizes', 'src', 'srcset', 'width']),
  ol: new Set(['reversed', 'start', 'type']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
};
const TRUSTED_IFRAME_HOSTS = new Set([
  'player.vimeo.com',
  'www.youtube.com',
  'www.youtube-nocookie.com',
]);

type OpenElement = {emitted: boolean; suppressContent: boolean; tagName: string};

export function sanitizeStorefrontHtml(value: string | null | undefined) {
  const output: string[] = [];
  const stack: OpenElement[] = [];

  const parser = new Parser(
    {
      onopentag(tagName, attributes) {
        const parentSuppresses = stack.some((element) => element.suppressContent);
        const suppressContent = parentSuppresses || ACTIVE_CONTENT_TAGS.has(tagName);
        const emitted = !suppressContent && ALLOWED_TAGS.has(tagName);
        stack.push({emitted, suppressContent, tagName});

        if (emitted) {
          output.push(`<${tagName}${serializeAttributes(tagName, attributes)}>`);
        }
      },
      ontext(text) {
        if (!stack.some((element) => element.suppressContent)) {
          output.push(escapeHtml(text));
        }
      },
      onclosetag(tagName) {
        const element = stack.pop();
        if (element?.emitted && !VOID_TAGS.has(tagName)) {
          output.push(`</${tagName}>`);
        }
      },
    },
    {decodeEntities: true, lowerCaseAttributeNames: true, lowerCaseTags: true},
  );

  parser.write(value ?? '');
  parser.end();
  return output.join('');
}

function serializeAttributes(tagName: string, attributes: Record<string, string>) {
  const safeAttributes: Record<string, string> = {};
  for (const [name, rawValue] of Object.entries(attributes)) {
    if (!GLOBAL_ATTRIBUTES.has(name) && !TAG_ATTRIBUTES[tagName]?.has(name)) continue;

    let value = rawValue;
    if ((name === 'href' || name === 'src') && !isSafeUrl(value, tagName)) continue;
    if (name === 'srcset' && !isSafeSrcSet(value)) continue;
    if (name === 'target' && value !== '_blank' && value !== '_self') continue;
    if (name === 'loading' && value !== 'lazy' && value !== 'eager') continue;
    if (name === 'src' && tagName === 'iframe' && !isTrustedIframe(value)) continue;

    safeAttributes[name] = value;
  }

  if (tagName === 'a' && safeAttributes.target === '_blank') {
    safeAttributes.rel = 'noopener noreferrer';
  }

  return Object.entries(safeAttributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
}

function isSafeUrl(value: string, tagName: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('\\')) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;

  try {
    const url = new URL(trimmed);
    if (tagName === 'img' || tagName === 'iframe') return url.protocol === 'https:';
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isTrustedIframe(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && TRUSTED_IFRAME_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isSafeSrcSet(value: string) {
  return value.split(',').every((candidate) => {
    const [url] = candidate.trim().split(/\s+/, 1);
    return Boolean(url) && isSafeUrl(url, 'img');
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}
