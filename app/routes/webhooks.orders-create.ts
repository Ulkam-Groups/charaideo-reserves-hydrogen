import {type ActionFunctionArgs} from 'react-router';
import {adminGraphql} from '~/lib/admin.server';
import {inventoryChanges, type TeaIngredient} from '~/lib/blend';

async function validSignature(body: string, signature: string | null) {
  if (!signature || !process.env.SHOPIFY_WEBHOOK_SECRET) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(process.env.SHOPIFY_WEBHOOK_SECRET), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return expected === signature;
}

export async function action({request}: ActionFunctionArgs) {
  const body = await request.text();
  if (!(await validSignature(body, request.headers.get('x-shopify-hmac-sha256')))) return new Response('Unauthorized', {status: 401});
  const order = JSON.parse(body) as {id: number; line_items: {properties?: {name: string; value: string}[]}[]};
  const orderId = `gid://shopify/Order/${order.id}`;
  const recipe = order.line_items.flatMap((line) => line.properties || []).find((p) => p.name === 'tea_blend')?.value;
  if (!recipe) return new Response(null, {status: 200});
  const existing = await adminGraphql<{node: {metafield: {value: string} | null}}>(`query($id: ID!) { node(id: $id) { ... on Order { metafield(namespace: "tea", key: "inventory_adjusted_at") { value } } } }`, {id: orderId});
  if (existing.node.metafield) return new Response(null, {status: 200});
  const items = (JSON.parse(recipe) as {items: TeaIngredient[]}).items;
  const inventoryItemIds = await Promise.all(items.map(async (item) => {
    const data = await adminGraphql<{productVariant: {inventoryItem: {id: string}}}>(`query($id: ID!) { productVariant(id: $id) { inventoryItem { id } } }`, {id: item.variantId});
    return data.productVariant.inventoryItem.id;
  }));
  const changes = inventoryChanges(items).map((change, index) => ({inventoryItemId: inventoryItemIds[index], locationId: process.env.SHOPIFY_LOCATION_ID!, delta: change.delta}));
  await adminGraphql(`mutation($input: InventoryAdjustQuantitiesInput!) { inventoryAdjustQuantities(input: $input) { userErrors { message } } }`, {input: {name: 'available', reason: 'correction', changes}});
  await adminGraphql(`mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`, {metafields: [{ownerId: orderId, namespace: 'tea', key: 'inventory_adjusted_at', type: 'date_time', value: new Date().toISOString()}]});
  return new Response(null, {status: 200});
}
