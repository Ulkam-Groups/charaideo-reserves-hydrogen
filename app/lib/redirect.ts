import {redirect} from 'react-router';

const LOCAL_REDIRECT_ORIGIN = 'https://local.invalid';

/** Accept only a path on this storefront for server-side redirects. */
export function safeLocalRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = '/',
) {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  const rawPath = value.split(/[?#]/, 1)[0];
  if (/^[\\/]{2}/.test(rawPath) || rawPath.includes('\\')) return fallback;
  if (/%(?:2f|5c)/i.test(rawPath)) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback;

  try {
    const target = new URL(value, LOCAL_REDIRECT_ORIGIN);
    if (target.origin !== LOCAL_REDIRECT_ORIGIN) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function redirectIfHandleIsLocalized(
  request: Request,
  ...localizedResources: Array<{
    handle: string;
    data: {handle: string} & unknown;
  }>
) {
  const url = new URL(request.url);
  let shouldRedirect = false;

  localizedResources.forEach(({handle, data}) => {
    if (handle !== data.handle) {
      url.pathname = url.pathname.replace(handle, data.handle);
      shouldRedirect = true;
    }
  });

  if (shouldRedirect) {
    throw redirect(url.toString());
  }
}
