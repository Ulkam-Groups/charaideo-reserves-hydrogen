import {type ActionFunctionArgs} from 'react-router';
import {updateTeaProduct} from '~/lib/admin.server';
const json = <T,>(data: T, init?: ResponseInit) => Response.json(data, init);

// This is an API boundary for a future authenticated staff UI. Do not call it from public storefront code.
export async function action({request}: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, {status: 405});
  const expected = process.env.ADMIN_INTERNAL_TOKEN;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return json({error: 'Unauthorized'}, {status: 401});
  try {
    const tea = await updateTeaProduct(await request.json());
    return json({tea});
  } catch (error) {
    return json({error: error instanceof Error ? error.message : 'Could not save tea.'}, {status: 400});
  }
}
