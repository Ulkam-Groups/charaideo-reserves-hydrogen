import {type ActionFunctionArgs} from 'react-router';
import {createBlendCheckout} from '~/lib/admin.server';
import type {TeaIngredient} from '~/lib/blend';
const json = <T,>(data: T, init?: ResponseInit) => Response.json(data, init);

export async function action({request}: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, {status: 405});
  try {
    const {items} = await request.json() as {items: TeaIngredient[]};
    return json({checkoutUrl: await createBlendCheckout(items)});
  } catch (error) {
    return json({error: error instanceof Error ? error.message : 'Unable to create checkout.'}, {status: 400});
  }
}
