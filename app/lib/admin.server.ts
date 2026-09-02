import {priceBlend, serialiseBlend, validateBlend, type BlendRules, type TeaIngredient} from './blend';

const domain = () => process.env.PUBLIC_STORE_DOMAIN!;
const endpoint = () => `https://${domain()}/admin/api/${process.env.SHOPIFY_ADMIN_API_VERSION || '2026-04'}/graphql.json`;

export async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(endpoint(), {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!}, body: JSON.stringify({query, variables})});
  if (!response.ok) throw new Error(`Admin API request failed (${response.status}).`);
  const result = await response.json() as {data?: T; errors?: {message: string}[]};
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join('; '));
  return result.data!;
}

export function rulesFromEnv(): BlendRules {
  return {minGrams: Number(process.env.BLEND_MIN_GRAMS || 50), maxGrams: Number(process.env.BLEND_MAX_GRAMS || 200), maxItems: 10, incrementGrams: 5, packagingPrice: Number(process.env.PACKAGING_PRICE || 0)};
}

export async function createBlendCheckout(items: TeaIngredient[]) {
  const rules = rulesFromEnv();
  const validation = validateBlend(items, rules);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const recipe = serialiseBlend(items, rules);
  const price = priceBlend(items, rules);
  const mutation = `mutation CreateBlendDraft($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { invoiceUrl } userErrors { field message } } }`;
  const data = await adminGraphql<{draftOrderCreate: {draftOrder: {invoiceUrl: string} | null; userErrors: {message: string}[]}}> (mutation, {input: {lineItems: [{title: `Custom Tea Box (${validation.totalGrams}g)`, quantity: 1, originalUnitPrice: String(price), customAttributes: [{key: 'tea_blend', value: recipe}, {key: 'fulfilment_note', value: 'Pack each ingredient separately inside one tea box.'}]}], tags: ['custom-tea-blend']}});
  if (!data.draftOrderCreate.draftOrder) throw new Error(data.draftOrderCreate.userErrors.map((e) => e.message).join(' ') || 'Could not create checkout.');
  return data.draftOrderCreate.draftOrder.invoiceUrl;
}

export async function updateTeaProduct(input: {id?: string; title: string; price: string; sku?: string; blendEligible: boolean; maxContributionGrams: number; pricePerGram: number}) {
  const mutation = `mutation UpsertTea($input: ProductSetInput!) { productSet(input: $input) { product { id } userErrors { message } } }`;
  const result = await adminGraphql<{productSet: {product: {id: string} | null; userErrors: {message: string}[]}}>(mutation, {input: {product: {id: input.id, title: input.title}, productOptions: [{name: 'Weight', values: [{name: '1g'}]}], variants: [{price: input.price, sku: input.sku, optionValues: [{optionName: 'Weight', name: '1g'}]}]}});
  const product = result.productSet.product;
  if (!product) throw new Error(result.productSet.userErrors.map((e) => e.message).join(' ') || 'Product could not be saved.');
  await adminGraphql(`mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`, {metafields: [
    {ownerId: product.id, namespace: 'tea', key: 'blend_eligible', type: 'boolean', value: String(input.blendEligible)},
    {ownerId: product.id, namespace: 'tea', key: 'max_contribution_g', type: 'number_integer', value: String(input.maxContributionGrams)},
    {ownerId: product.id, namespace: 'tea', key: 'price_per_gram', type: 'number_decimal', value: String(input.pricePerGram)}
  ]});
  return product;
}
