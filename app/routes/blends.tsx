import {useLoaderData} from 'react-router';
import type {Route} from './+types/blends';
import {BlendBuilder, type BlendTea} from '~/components/BlendBuilder';
import {defaultBlendRules} from '~/lib/blend';

export const meta: Route.MetaFunction = () => {
  return [{title: 'Assam Tea | Build your blend'}];
};

type BlendProduct = {
  id: string;
  title: string;
  metafields: Array<{value: string} | null>;
  variants: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
    }>;
  };
};

export async function loader({context}: Route.LoaderArgs) {
  const {products} = (await context.storefront.query(BLEND_PRODUCTS_QUERY, {
    variables: {first: 100},
  })) as {products: {nodes: BlendProduct[]}};

  const teas = products.nodes.flatMap((product) => {
    const variant = product.variants.nodes[0];
    const blendEligible = product.metafields[0]?.value === 'true';

    if (!variant || !blendEligible) return [];

    return [
      {
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        origin: product.metafields[1]?.value ?? undefined,
        teaType: product.metafields[2]?.value ?? undefined,
        pricePerGram: Number(product.metafields[3]?.value ?? 0),
        maxContributionGrams: Number(product.metafields[4]?.value ?? defaultBlendRules.maxGrams),
        availableForSale: variant.availableForSale,
        eligible: true,
      } satisfies BlendTea,
    ];
  });

  return {teas};
}

export default function Blends() {
  const {teas} = useLoaderData<typeof loader>();

  return (
    <main className="blend-page">
      {teas.length > 0 ? (
        <BlendBuilder teas={teas} />
      ) : (
        <section className="empty-state">
          <h1>Build your own tea blend</h1>
          <p>No teas are currently available for custom blending.</p>
        </section>
      )}
    </main>
  );
}

const BLEND_PRODUCTS_QUERY = `#graphql
  query BlendProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        metafields(identifiers: [
          {namespace: "tea", key: "blend_eligible"},
          {namespace: "tea", key: "origin"},
          {namespace: "tea", key: "category"},
          {namespace: "tea", key: "price_per_gram"},
          {namespace: "tea", key: "max_contribution_g"}
        ]) {
          value
        }
        variants(first: 1) {
          nodes {
            id
            availableForSale
          }
        }
      }
    }
  }
` as const;
