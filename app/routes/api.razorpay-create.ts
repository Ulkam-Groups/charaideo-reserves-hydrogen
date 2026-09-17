import type {Route} from './+types/api.razorpay-create';
import {createDraft, draftToMagicItems, paise, razorpayApi, razorpayConfigured, receiptFromDraftId, type MagicOrder} from '~/lib/razorpay.server';

const VARIANT_QUERY = `#graphql
  query MagicCheckoutVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant { id availableForSale }
    }
  }
`;

function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
}

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') return new Response('Method not allowed', {status: 405});
  if (!sameOrigin(request)) return new Response('Forbidden', {status: 403});
  if (!razorpayConfigured(context.env)) return Response.json({error: 'Checkout is not configured.'}, {status: 503});
  if (Number(request.headers.get('content-length') || 0) > 4096) return new Response('Payload too large', {status: 413});
  let input: {source?: unknown; variantId?: unknown};
  try { input = await request.json(); } catch { return new Response('Invalid JSON', {status: 400}); }

  let stage = 'validate';
  try {
    let lineItems: Array<{variantId: string; quantity: number}>;
    let note: string;
    if (input.source === 'cart') {
      const cart = await context.cart.get();
      if (!cart?.lines.nodes.length || cart.lines.nodes.length > 100) return Response.json({error: 'Cart is empty or too large.'}, {status: 422});
      if (cart.appliedGiftCards.length || cart.discountCodes.some((code) => code.applicable)) {
        return Response.json({error: 'Remove discount codes and gift cards before using Magic Checkout.'}, {status: 422});
      }
      lineItems = cart.lines.nodes.map((line) => ({variantId: line.merchandise.id, quantity: line.quantity}));
      if (lineItems.some((line) => !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(line.variantId) || line.quantity < 1)) {
        return Response.json({error: 'Cart contains an unsupported item.'}, {status: 422});
      }
      note = `Hydrogen cart ${cart.id}`;
    } else if (input.source === 'product' && typeof input.variantId === 'string' && /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(input.variantId)) {
      stage = 'shopify-variant';
      const result = await context.storefront.query(VARIANT_QUERY, {variables: {id: input.variantId}}) as {node?: {id: string; availableForSale: boolean}};
      if (!result.node?.availableForSale) return Response.json({error: 'This product is no longer available.'}, {status: 422});
      lineItems = [{variantId: result.node.id, quantity: 1}];
      note = 'Hydrogen Buy now';
    } else {
      return new Response('Invalid checkout source', {status: 400});
    }

    stage = 'shopify-draft';
    const draft = await createDraft(context.env, {lineItems, note});
    stage = 'draft-pricing';
    const amount = paise(draft.totalPriceSet.shopMoney.amount);
    if (amount < 100) return Response.json({error: 'Order amount is too low.'}, {status: 422});
    const magicItems = draftToMagicItems(draft);
    if (magicItems.reduce((sum, item) => sum + item.offer_price * item.quantity, 0) !== amount) {
      return Response.json({error: 'The Shopify total needs review before Magic Checkout can charge this cart.'}, {status: 422});
    }
    stage = 'razorpay-order';
    const order = await razorpayApi<MagicOrder>(context.env, '/orders', {
      amount,
      currency: 'INR',
      receipt: receiptFromDraftId(draft.id),
      line_items_total: amount,
      line_items: magicItems,
      notes: {shopify_draft_id: draft.id},
    });
    if (!/^order_[\w-]+$/.test(order.id) || order.receipt !== receiptFromDraftId(draft.id) || order.amount !== amount) {
      throw new Error('Razorpay order response did not match the Shopify draft');
    }
    context.session.set('magicCheckoutOrderId', order.id);
    return Response.json({key: context.env.RAZORPAY_KEY_ID, orderId: order.id}, {
      headers: {'Cache-Control': 'no-store', 'Set-Cookie': await context.session.commit()},
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({scope: 'razorpay-create', stage, errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: message.slice(0, 500)}));
    return Response.json({error: `Checkout could not be started at ${stage}. Please contact us if this persists.`, stage}, {status: 502});
  }
}
