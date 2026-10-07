export function applySecurityHeaders(response: Response, requestUrl: URL) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)',
  );
  if (requestUrl.pathname === '/admin' || requestUrl.pathname.startsWith('/admin/')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  if (requestUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  return response;
}
