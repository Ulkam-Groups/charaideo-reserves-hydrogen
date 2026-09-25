import {createServer} from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.E2E_STOREFRONT_PORT || 4174);
const money = (amount) => ({amount: amount.toFixed(2), currencyCode: 'INR'});
const productId = 'gid://shopify/Product/1001';
const variantId = 'gid://shopify/ProductVariant/2001';

const variant = {
  availableForSale: true,
  compareAtPrice: null,
  id: variantId,
  image: null,
  price: money(499),
  product: {title: 'E2E Assam Tea', handle: 'e2e-assam-tea'},
  selectedOptions: [{name: 'Size', value: '100g'}],
  sku: 'E2E-ASSAM-100G',
  title: '100g',
  unitPrice: null,
};

const catalogProduct = {
  id: productId,
  handle: 'e2e-assam-tea',
  title: 'E2E Assam Tea',
  vendor: 'Charaideo Reserves',
  productType: 'Assam Tea',
  tastingNotes: {value: 'Malt and honey'},
  description: 'A deterministic Assam tea used by the storefront E2E suite.',
  featuredImage: null,
  priceRange: {minVariantPrice: money(499), maxVariantPrice: money(499)},
  variants: {nodes: [variant]},
};

const product = {
  ...catalogProduct,
  brewingSuggestion: {value: 'Steep for four minutes.'},
  reviewRating: null,
  reviewCount: null,
  descriptionHtml: '<p>A deterministic Assam tea used by the storefront E2E suite.</p>',
  images: {nodes: []},
  encodedVariantExistence: '',
  encodedVariantAvailability: '',
  options: [
    {
      name: 'Size',
      optionValues: [{name: '100g', firstSelectableVariant: variant, swatch: null}],
    },
  ],
  selectedOrFirstAvailableVariant: variant,
  adjacentVariants: [],
  seo: {description: 'E2E Assam tea', title: 'E2E Assam Tea'},
};

const carts = new Map();
let nextCartId = 1;

function cartLine(input, cartNumber, index) {
  const quantity = Number(input.quantity || 1);
  return {
    id: `gid://shopify/CartLine/${cartNumber}-${index + 1}`,
    quantity,
    attributes: input.attributes || [],
    cost: {
      totalAmount: money(499 * quantity),
      amountPerQuantity: money(499),
      compareAtAmountPerQuantity: null,
    },
    merchandise: {
      ...variant,
      requiresShipping: true,
      product: {
        id: productId,
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
      },
    },
    parentRelationship: null,
  };
}

function cartResult(cart) {
  const totalQuantity = cart.lines.reduce((total, line) => total + line.quantity, 0);
  const total = cart.lines.reduce(
    (sum, line) => sum + Number(line.cost.totalAmount.amount),
    0,
  );
  return {
    updatedAt: new Date(0).toISOString(),
    id: cart.id,
    checkoutUrl: 'https://checkout.invalid/e2e',
    totalQuantity,
    buyerIdentity: {countryCode: 'US', customer: null, email: null, phone: null},
    lines: {nodes: cart.lines},
    cost: {
      subtotalAmount: money(total),
      totalAmount: money(total),
      totalDutyAmount: null,
      totalTaxAmount: null,
    },
    note: null,
    attributes: [],
    discountCodes: [],
    appliedGiftCards: [],
  };
}

function mutationPayload(name, cart) {
  return {[name]: {cart: cartResult(cart), userErrors: [], warnings: []}};
}

function execute(operation, variables) {
  switch (operation) {
    case 'ShopData':
      return {
        shop: {id: 'gid://shopify/Shop/1'},
        localization: {
          country: {currency: {isoCode: 'INR'}},
          language: {isoCode: 'EN'},
        },
      };
    case 'Header':
      return {
        shop: {
          id: 'gid://shopify/Shop/1',
          name: 'E2E Store',
          description: 'Local Storefront API fixture',
          primaryDomain: {url: `http://${host}:4173`},
          brand: {logo: null},
        },
        menu: null,
      };
    case 'ChapterCollectionList':
      return {collections: {nodes: []}};
    case 'Catalog':
      return {
        products: {
          nodes: [catalogProduct],
          pageInfo: {
            hasPreviousPage: false,
            hasNextPage: false,
            startCursor: 'e2e-start',
            endCursor: 'e2e-end',
          },
        },
      };
    case 'Product':
      return {product: variables.handle === product.handle ? product : null};
    case 'CartQuery': {
      const cart = carts.get(variables.cartId);
      return {cart: cart ? cartResult(cart) : null};
    }
    case 'cartCreate': {
      const cartNumber = nextCartId++;
      const id = `gid://shopify/Cart/e2e-${cartNumber}`;
      const lines = (variables.input?.lines || []).map((line, index) =>
        cartLine(line, cartNumber, index),
      );
      const cart = {id, lines};
      carts.set(id, cart);
      return mutationPayload('cartCreate', cart);
    }
    case 'cartLinesAdd': {
      const cart = carts.get(variables.cartId);
      if (!cart) throw new Error('Unknown fixture cart');
      const cartNumber = cart.id.split('-').at(-1);
      cart.lines.push(
        ...(variables.lines || []).map((line, index) =>
          cartLine(line, cartNumber, cart.lines.length + index),
        ),
      );
      return mutationPayload('cartLinesAdd', cart);
    }
    case 'cartLinesUpdate': {
      const cart = carts.get(variables.cartId);
      if (!cart) throw new Error('Unknown fixture cart');
      for (const update of variables.lines || []) {
        const line = cart.lines.find((candidate) => candidate.id === update.id);
        if (!line) continue;
        line.quantity = Number(update.quantity);
        line.cost.totalAmount = money(499 * line.quantity);
      }
      return mutationPayload('cartLinesUpdate', cart);
    }
    default:
      throw new Error(`Unsupported fixture operation: ${operation || 'unknown'}`);
  }
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, {'content-type': 'text/plain'});
    response.end('ok');
    return;
  }

  if (request.method !== 'POST' || !request.url?.endsWith('/graphql.json')) {
    response.writeHead(404);
    response.end();
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const {query = '', variables = {}} = JSON.parse(Buffer.concat(chunks).toString());
    const operation = /\b(?:query|mutation)\s+(\w+)/.exec(query)?.[1];
    const data = execute(operation, variables);
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({data}));
  } catch (error) {
    console.error(error);
    response.writeHead(400, {'content-type': 'application/json'});
    response.end(
      JSON.stringify({
        errors: [{message: error instanceof Error ? error.message : 'Fixture error'}],
      }),
    );
  }
});

server.listen(port, host);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
