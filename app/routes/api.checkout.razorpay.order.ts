import type {ActionFunctionArgs} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {readProtectedForm} from '~/lib/protected-write.server';
import {
  inrToPaise,
  parseRazorpayCheckoutProducts,
  type RazorpayOrderLine,
} from '~/lib/checkout/providers/razorpay/razorpay';
import {
  classifyRazorpayFailure,
  createRazorpayMagicOrder,
  razorpayCredentials,
} from '~/lib/checkout/providers/razorpay/razorpay.server';
import {razorpayOrderIntegrationReady} from '~/lib/checkout/providers/razorpay/razorpay-order.server';

type VariantNode = {
  id: string;
  title: string;
  sku?: string | null;
  availableForSale: boolean;
  price: {amount: string; currencyCode: string};
  compareAtPrice?: {amount: string} | null;
  image?: {url: string} | null;
  product: {id: string; title: string; description: string; handle: string};
};

const RAZORPAY_VARIANTS_QUERY = `#graphql
  query RazorpayCheckoutVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        sku
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount }
        image { url }
        product { id title description handle }
      }
    }
  }
` as const;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {'Cache-Control': 'no-store'},
  });
}

function cartLines(cart: CartApiQueryFragment, origin: string): RazorpayOrderLine[] {
  return cart.lines.nodes.map((line) => {
    const merchandise = line.merchandise;
    const linePaise = inrToPaise(line.cost.totalAmount.amount);
    if (linePaise % line.quantity !== 0) {
      throw new Error('Discounted line total cannot be represented in paise');
    }
    const unitPaise = linePaise / line.quantity;

    return {
      variantId: merchandise.id,
      productId: merchandise.product.id,
      quantity: line.quantity,
      unitPrice: (unitPaise / 100).toFixed(2),
      compareAtPrice: merchandise.compareAtPrice?.amount,
      currencyCode: line.cost.totalAmount.currencyCode,
      name: `${merchandise.product.title} - ${merchandise.title}`,
      description: merchandise.product.title,
      imageUrl: merchandise.image?.url,
      productUrl: new URL(`/products/${merchandise.product.handle}`, origin).toString(),
    };
  });
}

export async function action({request, context}: ActionFunctionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 16_384});
  if (form instanceof Response) return form;

  if (resolveCheckoutProvider(context.env.CHECKOUT_PROVIDER) !== 'razorpay') {
    return json({error: 'Checkout provider is unavailable'}, 404);
  }
  const credentials = razorpayCredentials(context.env);
  if (!credentials || !razorpayOrderIntegrationReady(context.env)) {
    return json({error: 'Checkout is not configured'}, 503);
  }

  const source = form.get('source');
  const requestedProducts = parseRazorpayCheckoutProducts(form.get('products'));
  if ((source !== 'cart' && source !== 'product') || !requestedProducts) {
    return json({error: 'Invalid checkout request'}, 400);
  }

  try {
    let lines: RazorpayOrderLine[];
    let expectedAmount: number;

    if (source === 'cart') {
      const cart = (await context.cart.get()) as CartApiQueryFragment | null;
      if (!cart?.lines.nodes.length || cart.appliedGiftCards.length) {
        return json({error: 'Cart is unavailable for this checkout'}, 409);
      }
      const cartProducts = cart.lines.nodes.map((line) => ({
        variantId: line.merchandise.id,
        quantity: line.quantity,
      }));
      if (JSON.stringify(cartProducts) !== JSON.stringify(requestedProducts)) {
        return json({error: 'Cart changed before checkout'}, 409);
      }
      lines = cartLines(cart, new URL(request.url).origin);
      expectedAmount = inrToPaise(cart.cost.subtotalAmount.amount);
    } else {
      const result = (await context.storefront.query(RAZORPAY_VARIANTS_QUERY, {
        variables: {ids: requestedProducts.map(({variantId}) => variantId)},
      })) as {nodes: Array<VariantNode | null>};
      const variants = result.nodes.filter(
        (variant: VariantNode | null): variant is VariantNode =>
          Boolean(variant?.availableForSale),
      );
      if (variants.length !== requestedProducts.length) {
        return json({error: 'A product is unavailable'}, 409);
      }
      lines = requestedProducts.map(({variantId, quantity}) => {
        const variant = variants.find((candidate) => candidate.id === variantId);
        if (!variant) throw new Error('Shopify variant was not returned');
        return {
          variantId: variant.id,
          productId: variant.product.id,
          sku: variant.sku,
          quantity,
          unitPrice: variant.price.amount,
          compareAtPrice: variant.compareAtPrice?.amount,
          currencyCode: variant.price.currencyCode,
          name: `${variant.product.title} - ${variant.title}`,
          description: variant.product.description || variant.product.title,
          imageUrl: variant.image?.url,
          productUrl: new URL(
            `/products/${variant.product.handle}`,
            request.url,
          ).toString(),
        };
      });
      expectedAmount = lines.reduce(
        (total, line) => total + inrToPaise(line.unitPrice) * line.quantity,
        0,
      );
    }

    const order = await createRazorpayMagicOrder({
      credentials,
      lines,
      source,
      expectedAmount,
      notes: {
        ...(typeof form.get('couponCode') === 'string'
          ? {coupon: String(form.get('couponCode')).slice(0, 100)}
          : {}),
        ...(typeof form.get('utmParams') === 'string'
          ? {utm: String(form.get('utmParams')).slice(0, 256)}
          : {}),
      },
    });
    context.session.set('razorpayOrderId', order.id);

    return json({
      keyId: credentials.keyId,
      orderId: order.id,
      businessName: context.env.RAZORPAY_BUSINESS_NAME?.trim() || 'Charaideo Reserves',
    });
  } catch (error) {
    const failure = classifyRazorpayFailure(error);
    context.monitor?.failure('checkout.razorpay.order.failure', failure.tags, error);
    return json({error: 'Unable to create checkout order', code: failure.code}, 502);
  }
}
