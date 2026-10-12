import {data} from 'react-router';
import type {Route} from './+types/cart[.]json';

export async function loader({context}: Route.LoaderArgs) {
  const cart = await context.cart.get();
  const lines = cart?.lines?.nodes ?? [];

  return data(
    {
      token: cart?.id ?? null,
      item_count: cart?.totalQuantity ?? 0,
      total_price: toMinorUnits(cart?.cost?.totalAmount?.amount),
      items: lines.map((line) => ({
        id: line.merchandise.id,
        variant_id: line.merchandise.id,
        quantity: line.quantity,
        title: line.merchandise.product.title,
        variant_title: line.merchandise.title,
        price: toMinorUnits(line.cost?.amountPerQuantity?.amount),
        final_line_price: toMinorUnits(line.cost?.totalAmount?.amount),
        url: `/products/${encodeURIComponent(line.merchandise.product.handle)}`,
        image: line.merchandise.image?.url ?? null,
      })),
    },
    {headers: {'Cache-Control': 'no-store'}},
  );
}

function toMinorUnits(amount: string | undefined) {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
