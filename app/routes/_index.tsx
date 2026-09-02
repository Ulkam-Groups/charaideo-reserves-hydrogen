import {type LoaderFunctionArgs} from 'react-router';
import {useLoaderData} from '@remix-run/react';
import {BlendBuilder, type BlendTea} from '~/components/BlendBuilder';
import {rulesFromEnv} from '~/lib/admin.server';

const TEAS = `#graphql
 query BlendableTeas { products(first: 100, query: "metafield:tea.blend_eligible:true") { nodes { title variants(first: 1) { nodes { id } } eligible: metafield(namespace: "tea", key: "blend_eligible") { value } max: metafield(namespace: "tea", key: "max_contribution_g") { value } price: metafield(namespace: "tea", key: "price_per_gram") { value } } } }`;
const json = <T,>(data: T) => Response.json(data);
export async function loader({context}: LoaderFunctionArgs) {
  const data = await context.storefront.query(TEAS, {cache: context.storefront.CacheShort()});
  const teas: BlendTea[] = data.products.nodes.flatMap((product: any) => product.variants.nodes[0] ? [{variantId: product.variants.nodes[0].id, title: product.title, eligible: product.eligible?.value === 'true', maxContributionGrams: Number(product.max?.value || 100), pricePerGram: Number(product.price?.value || 0)}] : []);
  return json({teas, rules: rulesFromEnv()});
}
export default function Index() { const {teas, rules} = useLoaderData<typeof loader>(); return <main><header><span className="brand-mark">✦</span><span>Assam tea atelier</span><nav><a href="/account">Account</a></nav></header><BlendBuilder teas={teas} rules={rules}/></main>; }
