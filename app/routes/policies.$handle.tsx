import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/policies.$handle';
import {sanitizeStorefrontHtml} from '~/lib/html.server';
import {getPolicyPage, POLICY_PAGES} from '~/lib/policies';

export const meta: Route.MetaFunction = ({data}) => [
  {title: `${data?.policy.title ?? 'Policy'} | Charaideo Reserves™`},
];

export async function loader({params, context}: Route.LoaderArgs) {
  const selected = getPolicyPage(params.handle);
  if (!selected) throw new Response('Could not find the policy', {status: 404});

  const {shop} = await context.storefront.query(POLICY_CONTENT_QUERY);
  const publishedPolicy = shop?.[selected.field];
  const title = publishedPolicy?.title || selected.title;
  const body = publishedPolicy?.body?.trim()
    ? publishedPolicy.body
    : selected.fallbackBody;

  return {policy: {handle: selected.handle, title, body: sanitizeStorefrontHtml(body)}};
}

export default function Policy() {
  const {policy} = useLoaderData<typeof loader>();
  return (
    <div className="policy-page">
      <header className="policy-hero">
        <div className="policy-hero-inner">
          <nav className="listing-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link to="/policies">Policies</Link>
            <span aria-hidden="true">/</span>
            <span>{policy.title}</span>
          </nav>
          <span className="eyebrow">Charaideo Reserves™ / Information</span>
          <h1>{policy.title}</h1>
          <p>Details for shopping with Charaideo Reserves™.</p>
        </div>
      </header>
      <div className="policy-layout">
        <nav className="policy-nav" aria-label="Store policies">
          <span className="eyebrow">Browse policies</span>
          {POLICY_PAGES.map(({handle, title}) => (
            <Link
              key={handle}
              aria-current={policy.handle === handle ? 'page' : undefined}
              to={`/policies/${handle}`}
            >
              {title}
            </Link>
          ))}
        </nav>
        <article className="policy-content">
          <div className="policy-body" dangerouslySetInnerHTML={{__html: policy.body}} />
          <div className="policy-help">
            <h2>Need help?</h2>
            <p>Contact us if you have a question about this policy or an order.</p>
            <Link to="/pages/contact">Contact Charaideo Reserves™ →</Link>
          </div>
        </article>
      </div>
    </div>
  );
}

const POLICY_CONTENT_QUERY = `#graphql
  query Policy {
    shop {
      privacyPolicy { title body }
      refundPolicy { title body }
      shippingPolicy { title body }
      termsOfService { title body }
    }
  }
` as const;
