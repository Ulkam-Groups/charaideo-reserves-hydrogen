import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/policies.$handle';
import {type Shop} from '@shopify/hydrogen/storefront-api-types';
import {sanitizeStorefrontHtml} from '~/lib/html.server';

type SelectedPolicies = keyof Pick<
  Shop,
  'privacyPolicy' | 'shippingPolicy' | 'termsOfService' | 'refundPolicy'
>;

const POLICY_LINKS = [
  {handle: 'privacy-policy', title: 'Privacy Policy', field: 'privacyPolicy'},
  {handle: 'refund-policy', title: 'Refund Policy', field: 'refundPolicy'},
  {handle: 'shipping-policy', title: 'Shipping Policy', field: 'shippingPolicy'},
  {handle: 'terms-of-service', title: 'Terms of Service', field: 'termsOfService'},
] as const;

export const meta: Route.MetaFunction = ({data}) => [
  {title: `${data?.policy.title ?? 'Policy'} | Charaideo Reserves`},
];

export async function loader({params, context}: Route.LoaderArgs) {
  const selected = POLICY_LINKS.find(({handle}) => handle === params.handle);
  if (!selected) throw new Response('Could not find the policy', {status: 404});

  const policyName = selected.field as SelectedPolicies;
  const data = await context.storefront.query(POLICY_CONTENT_QUERY, {
    variables: {
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyName]: true,
      language: context.storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[policyName];
  if (!policy) throw new Response('Could not find the policy', {status: 404});
  return {policy: {...policy, body: sanitizeStorefrontHtml(policy.body)}};
}

export default function Policy() {
  const {policy} = useLoaderData<typeof loader>();
  return (
    <div className="policy-page">
      <header className="policy-hero">
        <div className="policy-hero-inner">
          <Link className="policy-back" to="/policies">← All policies</Link>
          <span className="eyebrow">Charaideo Reserves / Information</span>
          <h1>{policy.title}</h1>
          <p>Details for shopping with Charaideo Reserves.</p>
        </div>
      </header>
      <div className="policy-layout">
        <nav className="policy-nav" aria-label="Store policies">
          <span className="eyebrow">Browse policies</span>
          {POLICY_LINKS.map(({handle, title}) => (
            <Link key={handle} aria-current={policy.handle === handle ? 'page' : undefined} to={`/policies/${handle}`}>
              {title}
            </Link>
          ))}
        </nav>
        <article className="policy-content">
          <div className="policy-body" dangerouslySetInnerHTML={{__html: policy.body}} />
          <div className="policy-help">
            <h2>Need help?</h2>
            <p>Contact us if you have a question about this policy or an order.</p>
            <Link to="/pages/contact">Contact Charaideo Reserves →</Link>
          </div>
        </article>
      </div>
    </div>
  );
}

const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) { ...Policy }
      shippingPolicy @include(if: $shippingPolicy) { ...Policy }
      termsOfService @include(if: $termsOfService) { ...Policy }
      refundPolicy @include(if: $refundPolicy) { ...Policy }
    }
  }
` as const;
