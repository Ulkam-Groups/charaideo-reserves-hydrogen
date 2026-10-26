import type {Route} from './+types/$';
import {data, Link} from 'react-router';

export const meta: Route.MetaFunction = () => [
  {title: 'Page not found | Charaideo Reserves™'},
  {name: 'robots', content: 'noindex,follow'},
];

export async function loader({request}: Route.LoaderArgs) {
  return data(
    {path: new URL(request.url).pathname},
    {status: 404},
  );
}

export default function CatchAllPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-mark" aria-hidden="true">
        404
      </div>
      <p className="eyebrow">The trail ends here</p>
      <h1>This page has left the reserve.</h1>
      <p className="not-found-copy">
        The address may have changed, or the page may no longer be available.
        Continue exploring our Assam teas and stories.
      </p>
      <div className="not-found-actions">
        <Link className="button primary" to="/reserve-list">
          Explore the Tea Shop
        </Link>
        <Link className="button secondary" to="/">
          Return home
        </Link>
      </div>
      <Link className="not-found-academy" to="/tea-academy">
        Visit the Tea Academy <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
