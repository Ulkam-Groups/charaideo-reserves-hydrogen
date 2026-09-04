import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {useLoaderData, Form, useActionData} from 'react-router';
import {json} from 'react-router';
import {updateTeaProduct} from '~/lib/admin.server';
import {rulesFromEnv} from '~/lib/admin.server';

export async function loader(_args: LoaderFunctionArgs) {
  // Provide default rules and nothing else for now.
  return json({rules: rulesFromEnv()});
}

export async function action({request}: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, {status: 405});
  try {
    const form = await request.formData();
    const id = form.get('id')?.toString();
    const title = form.get('title')?.toString() || '';
    const price = form.get('price')?.toString() || '0.00';
    const sku = form.get('sku')?.toString() || '';
    const blendEligible = form.get('blendEligible') === 'on';
    const maxContributionGrams = Number(form.get('maxContributionGrams') || 100);
    const pricePerGram = Number(form.get('pricePerGram') || 1);

    const result = await updateTeaProduct({id, title, price, sku, blendEligible, maxContributionGrams, pricePerGram});
    return json({ok: true, product: result});
  } catch (error) {
    return json({error: error instanceof Error ? error.message : 'Could not save'}, {status: 400});
  }
}

export default function AdminTeasRoute() {
  const data = useLoaderData() as {rules: unknown};
  const action = useActionData() as {ok?: boolean; error?: string} | undefined;

  return (
    <div style={{maxWidth: 760, margin: '32px auto', padding: 20}}>
      <h1>Admin — Teas</h1>
      <p>Create or update a tea product. This action runs server-side and updates the real Shopify product via the Admin API.</p>

      {action?.error && <div style={{color: 'crimson'}}>{action.error}</div>}
      {action?.ok && <div style={{color: 'green'}}>Saved successfully.</div>}

      <Form method="post">
        <label style={{display: 'block', margin: '8px 0'}}>
          Product ID (optional for update)
          <input name="id" />
        </label>
        <label style={{display: 'block', margin: '8px 0'}}>
          Title
          <input name="title" required />
        </label>
        <label style={{display: 'block', margin: '8px 0'}}>
          Price
          <input name="price" required defaultValue="0.00" />
        </label>
        <label style={{display: 'block', margin: '8px 0'}}>
          SKU
          <input name="sku" />
        </label>
        <label style={{display: 'block', margin: '8px 0'}}>
          Price per gram
          <input name="pricePerGram" type="number" step="0.01" defaultValue={1} />
        </label>
        <label style={{display: 'block', margin: '8px 0'}}>
          Max contribution (g)
          <input name="maxContributionGrams" type="number" defaultValue={100} />
        </label>
        <label style={{display: 'block', margin: '8px 0'}}>
          Blend eligible
          <input name="blendEligible" type="checkbox" />
        </label>

        <div style={{marginTop: 12}}>
          <button type="submit">Save tea</button>
        </div>
      </Form>
    </div>
  );
}
