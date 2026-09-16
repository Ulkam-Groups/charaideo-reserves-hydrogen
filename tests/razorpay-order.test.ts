import test from 'node:test';
import assert from 'node:assert/strict';
import {draftIdFromReceipt, paymentKind, razorpayConfigured, receiptFromDraftId, synchronizeConfirmedOrder, verifyCheckoutSignature} from '../app/lib/razorpay.server.ts';

test('private preview checkout can use server confirmation without a public webhook', () => {
  const env = {RAZORPAY_KEY_ID: 'rzp_test_123', RAZORPAY_KEY_SECRET: 'secret', SHOPIFY_ADMIN_API_TOKEN: 'token', RAZORPAY_CUSTOM_SHIPPING_READY: 'true'} as Env;
  assert.equal(razorpayConfigured(env), true);
  assert.equal(razorpayConfigured({...env, RAZORPAY_CUSTOM_SHIPPING_READY: 'false'}), false);
});

test('checkout signature verifies the server-side order and payment pair', async () => {
  const secret = 'test-key-secret';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('order_123|pay_456'));
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  assert.equal(await verifyCheckoutSignature('order_123', 'pay_456', signature, secret), true);
  assert.equal(await verifyCheckoutSignature('order_123', 'pay_other', signature, secret), false);
});

test('only captured prepaid or placed COD payments qualify for Shopify orders', () => {
  const order = {id: 'order_123', receipt: 'draft_123', amount: 50000, currency: 'INR', status: 'paid'};
  const payment = {id: 'pay_456', order_id: order.id, amount: 50000, currency: 'INR', method: 'upi', status: 'captured', captured: true};
  assert.equal(paymentKind(order, payment), 'prepaid');
  assert.equal(paymentKind(order, {...payment, status: 'authorized', captured: false}), null);
  assert.equal(paymentKind({...order, status: 'placed'}, {...payment, method: 'cod', status: 'pending', captured: false}), 'cod');
  assert.equal(paymentKind({...order, status: 'placed'}, {...payment, method: 'cod', status: 'pending', captured: false, amount: 49999}), null);
});

test('Razorpay receipt references exactly one Shopify draft', () => {
  assert.equal(receiptFromDraftId('gid://shopify/DraftOrder/123'), 'draft_123');
  assert.equal(draftIdFromReceipt('draft_123'), 'gid://shopify/DraftOrder/123');
  assert.equal(draftIdFromReceipt('order_123'), null);
});

test('captured payment completes one matching Shopify draft at the verified total', async () => {
  const originalFetch = globalThis.fetch;
  const operations: string[] = [];
  const draft = (amount: string, completed = false) => ({
    id: 'gid://shopify/DraftOrder/123',
    order: completed ? {id: 'gid://shopify/Order/789', name: '#1001', displayFinancialStatus: 'PAID', totalPriceSet: {shopMoney: {amount: '550.00', currencyCode: 'INR'}}} : null,
    totalPriceSet: {shopMoney: {amount, currencyCode: 'INR'}},
    lineItems: {nodes: [{quantity: 1, name: 'Tea', sku: 'tea', variant: {id: 'gid://shopify/ProductVariant/456', image: null}, originalUnitPriceSet: {shopMoney: {amount: '500.00'}}}]},
  });
  const env = {RAZORPAY_KEY_ID: 'rzp_test_123', RAZORPAY_KEY_SECRET: 'secret', PUBLIC_STORE_DOMAIN: 'store.myshopify.com', SHOPIFY_ADMIN_API_TOKEN: 'token'} as Env;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/orders/order_123')) return Response.json({id: 'order_123', receipt: 'draft_123', amount: 55000, line_items_total: 50000, currency: 'INR', status: 'paid', shipping_fee: 5000, cod_fee: 0, customer_details: {email: 'buyer@example.com', shipping_address: {name: 'Tea Buyer', line1: 'One Street', city: 'Mumbai', state: 'Maharashtra', zipcode: '400001', country: 'IN'}}});
    if (url.endsWith('/payments/pay_456')) return Response.json({id: 'pay_456', order_id: 'order_123', amount: 55000, currency: 'INR', status: 'captured', method: 'upi', captured: true});
    const body = JSON.parse(String(init?.body)) as {query: string; variables: {pending?: boolean}};
    if (body.query.includes('GetMagicDraft')) { operations.push('get'); return Response.json({data: {draftOrder: draft('500.00')}}); }
    if (body.query.includes('UpdateMagicDraft')) { operations.push('update'); return Response.json({data: {draftOrderUpdate: {draftOrder: draft('550.00'), userErrors: []}}}); }
    if (body.query.includes('CompleteMagicDraft')) { operations.push(`complete:${body.variables.pending}`); return Response.json({data: {draftOrderComplete: {draftOrder: {order: {id: 'gid://shopify/Order/789', name: '#1001', displayFinancialStatus: 'PAID', totalPriceSet: {shopMoney: {amount: '550.00', currencyCode: 'INR'}}}}, userErrors: []}}}); }
    throw new Error('Unexpected API request');
  };
  try {
    assert.deepEqual(await synchronizeConfirmedOrder(env, 'order_123', 'pay_456'), {id: 'gid://shopify/Order/789', name: '#1001'});
    assert.deepEqual(operations, ['get', 'update', 'complete:false']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('placed COD payment reuses its existing pending Shopify order', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const env = {RAZORPAY_KEY_ID: 'rzp_test_123', RAZORPAY_KEY_SECRET: 'secret', PUBLIC_STORE_DOMAIN: 'store.myshopify.com', SHOPIFY_ADMIN_API_TOKEN: 'token'} as Env;
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/orders/order_cod')) return Response.json({id: 'order_cod', receipt: 'draft_123', amount: 56500, line_items_total: 50000, currency: 'INR', status: 'placed', shipping_fee: 5000, cod_fee: 1500});
    if (url.endsWith('/payments/pay_cod')) return Response.json({id: 'pay_cod', order_id: 'order_cod', amount: 56500, currency: 'INR', status: 'pending', method: 'cod', captured: false});
    return Response.json({data: {draftOrder: {id: 'gid://shopify/DraftOrder/123', order: {id: 'gid://shopify/Order/790', name: '#1002', displayFinancialStatus: 'PENDING', totalPriceSet: {shopMoney: {amount: '565.00', currencyCode: 'INR'}}}, totalPriceSet: {shopMoney: {amount: '500.00', currencyCode: 'INR'}}, lineItems: {nodes: []}}}});
  };
  try {
    assert.deepEqual(await synchronizeConfirmedOrder(env, 'order_cod', 'pay_cod'), {id: 'gid://shopify/Order/790', name: '#1002'});
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
