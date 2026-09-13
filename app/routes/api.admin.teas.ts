const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: {'Cache-Control': 'no-store'},
  });

// The unfinished staff mutation API remains unavailable until it is protected
// by Shopify session-token authentication and explicit authorization.
export const loader = notFound;
export const action = notFound;
