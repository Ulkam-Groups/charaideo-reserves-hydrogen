import {Link} from 'react-router';
import type {Route} from './+types/policies._index';
import {useLoaderData} from 'react-router';
import {POLICY_PAGES} from '~/lib/policies';

export async function loader({context}: Route.LoaderArgs) {
  const {shop} = await context.storefront.query(POLICIES_QUERY);
  const policies = POLICY_PAGES.map((page) => ({
    handle: page.handle,
    title: shop?.[page.field]?.title || page.title,
  }));
  return {policies};
}

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();
  return (
    <div className="policies-page">
      <header className="policy-hero">
        <div className="policy-hero-inner">
          <nav className="listing-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Policies</span>
          </nav>
          <span className="eyebrow">Charaideo Reserves™ / Information</span>
          <h1>Store policies</h1>
          <p>
            Information about ordering, delivery, returns, and how we handle your data.
          </p>
        </div>
      </header>
      <div className="policies-list">
        {policies.map((policy, index) => (
          <Link key={policy.handle} to={`/policies/${policy.handle}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{policy.title}</strong>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy { title }
      refundPolicy { title }
      shippingPolicy { title }
      termsOfService { title }
    }
  }
` as const;
