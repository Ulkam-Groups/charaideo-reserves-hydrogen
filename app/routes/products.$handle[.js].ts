import type {Route} from './+types/products.$handle[.js]';

type FastrrProductResult = {
  product: {
    id: string;
    title: string;
    handle: string;
    descriptionHtml: string;
    vendor: string;
    productType: string;
    featuredImage: {url: string} | null;
    images: {nodes: Array<{url: string}>};
    options: Array<{name: string}>;
    variants: {
      nodes: Array<{
        id: string;
        title: string;
        sku: string | null;
        availableForSale: boolean;
        price: {amount: string};
        compareAtPrice: {amount: string} | null;
        image: {url: string} | null;
        selectedOptions: Array<{name: string; value: string}>;
      }>;
    };
  } | null;
};

/**
 * Compatibility resource for the Fastrr Shopify-channel SDK.
 *
 * The vendor script requests the current product pathname with `.js` appended,
 * matching Shopify's Ajax Product API. Hydrogen does not provide that endpoint,
 * so without this route every PDP produces a 404 and the SDK continues with an
 * invalid product value.
 */
type ProductJsonLoaderArgs = Pick<Route.LoaderArgs, 'context' | 'params'>;

export async function loader(args: Route.LoaderArgs) {
  return loadShopifyAjaxProduct(args);
}

export async function loadShopifyAjaxProduct({
  context,
  params,
}: ProductJsonLoaderArgs) {
  if (!params.handle) {
    throw new Response('Not Found', {status: 404});
  }

  const {product} = (await context.storefront.query(FASTRR_PRODUCT_QUERY, {
    variables: {handle: params.handle},
    cache: context.storefront.CacheShort({
      maxAge: 300,
      staleWhileRevalidate: 3600,
    }),
    displayName: 'Fastrr product JSON compatibility',
  })) as FastrrProductResult;

  if (!product) {
    throw new Response('Not Found', {status: 404});
  }

  const variants = product.variants.nodes.map((variant) => ({
    id: numericShopifyId(variant.id),
    product_id: numericShopifyId(product.id),
    title: variant.title,
    name: variant.title,
    public_title: variant.title === 'Default Title' ? null : variant.title,
    sku: variant.sku ?? '',
    available: variant.availableForSale,
    price: moneyToCents(variant.price.amount),
    compare_at_price: variant.compareAtPrice
      ? moneyToCents(variant.compareAtPrice.amount)
      : null,
    featured_image: variant.image?.url ?? product.featuredImage?.url ?? null,
    options: variant.selectedOptions.map((option) => option.value),
    option1: variant.selectedOptions[0]?.value ?? null,
    option2: variant.selectedOptions[1]?.value ?? null,
    option3: variant.selectedOptions[2]?.value ?? null,
  }));

  return Response.json(
    {
      id: numericShopifyId(product.id),
      title: product.title,
      handle: product.handle,
      description: product.descriptionHtml,
      body_html: product.descriptionHtml,
      vendor: product.vendor,
      type: product.productType,
      product_type: product.productType,
      available: variants.some((variant) => variant.available),
      price: variants.length ? Math.min(...variants.map((variant) => variant.price)) : 0,
      featured_image: product.featuredImage?.url ?? null,
      variants,
      images: product.images.nodes.map((image) => image.url),
      options: product.options.map((option) => option.name),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      },
    },
  );
}

function moneyToCents(amount: string) {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function numericShopifyId(gid: string) {
  const id = gid.slice(gid.lastIndexOf('/') + 1);
  return /^\d+$/.test(id) ? id : gid;
}

const FASTRR_PRODUCT_QUERY = `#graphql
  query FastrrProductJson(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      descriptionHtml
      vendor
      productType
      featuredImage { url }
      images(first: 20) { nodes { url } }
      options { name }
      variants(first: 250) {
        nodes {
          id
          title
          sku
          availableForSale
          price { amount }
          compareAtPrice { amount }
          image { url }
          selectedOptions { name value }
        }
      }
    }
  }
` as const;
