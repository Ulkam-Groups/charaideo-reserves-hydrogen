import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {useLoaderData, Form, useActionData} from 'react-router';
import {json} from 'react-router';
import React, {useState, useEffect} from 'react';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {adminGraphql} from '~/lib/admin.server';

export async function loader({request, context}: LoaderFunctionArgs) {
  // Local dev convenience: avoid Customer Account OAuth requirement when running on localhost.
  try {
    const url = new URL(request.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return json({blends: []});
    }

    context.customerAccount.handleAuthStatus();
    const {data} = await context.customerAccount.query(CUSTOMER_DETAILS_QUERY, {variables: {language: context.customerAccount.i18n.language}});
    const customer = data?.customer;
    if (!customer) return json({blends: []});

    // Fetch customer metafield via Admin API
    const res = await adminGraphql<{node: {metafield: {value: string} | null}}>(`query($id: ID!) { node(id: $id) { ... on Customer { metafield(namespace: "tea", key: "saved_blends") { value } } } }`, {id: customer.id});
    const value = res.node.metafield?.value;
    const blends = value ? JSON.parse(value) : [];
    return json({blends});
  } catch (err: any) {
    if (err instanceof Response) throw err;
    console.error('account.blends loader error', err);
    // Return 200 with error payload so the UI can render a friendly message
    return json({error: err?.message ?? 'Could not load saved blends', blends: []});
  }
}

export async function action({request, context}: ActionFunctionArgs) {
  try {
    if (request.method !== 'POST') return json({error: 'Method not allowed'}, {status: 405});
    context.customerAccount.handleAuthStatus();
    const {data} = await context.customerAccount.query(CUSTOMER_DETAILS_QUERY, {variables: {language: context.customerAccount.i18n.language}});
    const customer = data?.customer;
    if (!customer) return json({error: 'Not authenticated'}, {status: 401});

    const form = await request.formData();
    const method = form.get('_method')?.toString() || 'create';

    const res = await adminGraphql<{node: {metafield: {value: string} | null}}>(`query($id: ID!) { node(id: $id) { ... on Customer { metafield(namespace: "tea", key: "saved_blends") { value } } } }`, {id: customer.id});
    const existing = res.node.metafield?.value ? JSON.parse(res.node.metafield.value) : [];

    if (method === 'delete') {
      const id = form.get('id')?.toString();
      const filtered = existing.filter((r: any) => r.id !== id);
      await adminGraphql(`mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`, {metafields: [{ownerId: customer.id, namespace: 'tea', key: 'saved_blends', type: 'json', value: JSON.stringify(filtered)}]});
      return json({ok: true, deleted: id});
    }

    if (method === 'edit') {
      const id = form.get('id')?.toString();
      const name = form.get('name')?.toString() || 'Saved blend';
      const blend = JSON.parse(form.get('blend')?.toString() || '{}');
      const updated = existing.map((r: any) => r.id === id ? {...r, name, blend} : r);
      await adminGraphql(`mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`, {metafields: [{ownerId: customer.id, namespace: 'tea', key: 'saved_blends', type: 'json', value: JSON.stringify(updated)}]});
      return json({ok: true, updatedId: id});
    }

    // create
    const blend = form.get('blend')?.toString() || '';
    const name = form.get('name')?.toString() || 'Saved blend';
    const record = {id: `blend_${Date.now()}`, name, blend: JSON.parse(blend)};
    existing.push(record);
    await adminGraphql(`mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`, {metafields: [{ownerId: customer.id, namespace: 'tea', key: 'saved_blends', type: 'json', value: JSON.stringify(existing)}]});
    return json({ok: true, saved: record});
  } catch (err: any) {
    if (err instanceof Response) throw err;
    console.error('account.blends action error', err);
    return json({error: err?.message ?? 'Could not modify saved blends'}, {status: 400});
  }
}

export default function AccountBlends() {
  const data = useLoaderData() as {blends: any[]};
  const action = useActionData() as {ok?: boolean; saved?: any; error?: string} | undefined;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [blendInput, setBlendInput] = useState(JSON.stringify({items: [], totalGrams: 0}));

  useEffect(() => {
    if (!editingId) return;
    const b = data.blends.find((x: any) => x.id === editingId);
    if (b) {
      setNameInput(b.name || '');
      setBlendInput(JSON.stringify(b.blend || {items: [], totalGrams: 0}, null, 2));
    }
  }, [editingId, data.blends]);

  return (
    <div style={{maxWidth: 880, margin: '24px auto', padding: 20}}>
      <h2>Saved blends</h2>
      {data.blends.length === 0 ? <p>No saved blends yet.</p> : (
        <ul>
          {data.blends.map((b: any) => (
            <li key={b.id} style={{marginBottom: 12}}>
              <strong>{b.name}</strong> — {b.blend?.totalGrams ?? ''}g
              <div style={{display: 'inline-flex', gap: 8, marginLeft: 12}}>
                <button onClick={() => setEditingId(b.id)}>Edit</button>
                <Form method="post" reloadDocument>
                  <input type="hidden" name="_method" value="delete" />
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit">Delete</button>
                </Form>
              </div>
              {editingId === b.id && (
                <div style={{marginTop: 8, padding: 8, border: '1px solid #eee'}}>
                  <Form method="post">
                    <input type="hidden" name="_method" value="edit" />
                    <input type="hidden" name="id" value={b.id} />
                    <label>
                      Name
                      <input name="name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                    </label>
                    <label>
                      Blend JSON
                      <textarea name="blend" rows={6} value={blendInput} onChange={(e) => setBlendInput(e.target.value)} />
                    </label>
                    <div style={{marginTop: 8}}>
                      <button type="submit">Save changes</button>
                      <button type="button" onClick={() => setEditingId(null)} style={{marginLeft: 8}}>Close</button>
                    </div>
                  </Form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>Save current blend</h3>
      {action?.error && <div style={{color: 'crimson'}}>{action.error}</div>}
      {action?.ok && <div style={{color: 'green'}}>Saved: {action.saved?.name}</div>}

      <Form method="post">
        <label>
          Name
          <input name="name" defaultValue={data.blends[0]?.name ?? ''} />
        </label>
        <label>
          Blend JSON
          <textarea name="blend" rows={6} defaultValue={JSON.stringify({items: [], totalGrams: 0})} />
        </label>
        <div style={{marginTop: 8}}>
          <button type="submit">Save blend</button>
        </div>
      </Form>
    </div>
  );
}
