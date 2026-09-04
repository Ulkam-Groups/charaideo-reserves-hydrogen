import {ServerRouter} from 'react-router';
import {renderToReadableStream} from 'react-dom/server.browser';

export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: any,
) {
  headers.set('Content-Type', 'text/html');
  return new Response(
    await renderToReadableStream(
      <ServerRouter context={context} url={request.url} />,
      {signal: request.signal},
    ),
    {status, headers},
  );
}
