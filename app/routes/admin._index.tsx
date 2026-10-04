import {data, Form, Link, redirect, useNavigation, useSearchParams} from 'react-router';
import type {Route} from './+types/admin._index';
import {AdminAlert, AdminShell} from '~/components/AdminShell';
import {readProtectedForm} from '~/lib/protected-write.server';
import {
  ensureAdminMetafieldDefinitions,
  listAdminProducts,
  ShopifyAdminError,
} from '~/lib/shopify-admin.server';

export const meta: Route.MetaFunction = () => [
  {title: 'Products | Charaideo Product Studio'},
  {name: 'robots', content: 'noindex,nofollow,noarchive'},
];

export function headers() {
  return {'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive'};
}

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const after = url.searchParams.get('after');
  const search = url.searchParams.get('q');
  try {
    const products = await listAdminProducts(context.env, {after, search});
    return {products, search: search || '', error: null};
  } catch (error) {
    const message =
      error instanceof ShopifyAdminError ? error.message : 'Unable to load products.';
    return data({products: null, search: search || '', error: message}, {status: 502});
  }
}

export async function action({request, context}: Route.ActionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 4_096});
  if (form instanceof Response) return form;
  if (form.get('intent') !== 'ensure-definitions')
    return data({error: 'Unknown action.'}, {status: 400});
  try {
    const result = await ensureAdminMetafieldDefinitions(context.env);
    throw redirect(`/admin?definitions=${result.created}`);
  } catch (error) {
    if (error instanceof Response) throw error;
    const message =
      error instanceof ShopifyAdminError
        ? error.message
        : 'Unable to create definitions.';
    return data({error: message}, {status: 502});
  }
}

export default function AdminProducts({loaderData, actionData}: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const products = loaderData.products?.nodes ?? [];
  const created = searchParams.get('definitions');
  return (
    <AdminShell>
      <div className="admin-page-heading">
        <div>
          <p className="admin-kicker">Catalog</p>
          <h1>Products</h1>
          <p>Open any product to edit its core details, variants, and metafields.</p>
        </div>
        <Form method="post">
          <input name="intent" type="hidden" value="ensure-definitions" />
          <button
            className="admin-button"
            disabled={navigation.state === 'submitting'}
            type="submit"
          >
            {navigation.state === 'submitting'
              ? 'Checking definitions…'
              : 'Set up metafield definitions'}
          </button>
        </Form>
      </div>

      {created !== null && (
        <AdminAlert tone="success">
          {created === '0'
            ? 'All 29 Charaideo metafield definitions already exist.'
            : `Created ${created} missing metafield definition${created === '1' ? '' : 's'}.`}
        </AdminAlert>
      )}
      {actionData?.error && <AdminAlert tone="critical">{actionData.error}</AdminAlert>}
      {loaderData.error && <AdminAlert tone="critical">{loaderData.error}</AdminAlert>}

      <Form className="admin-search" method="get" role="search">
        <label className="admin-sr-only" htmlFor="product-search">
          Search products
        </label>
        <input
          defaultValue={loaderData.search}
          id="product-search"
          name="q"
          placeholder="Search title, handle, tag, vendor…"
          type="search"
        />
        <button className="admin-button admin-button--primary" type="submit">
          Search
        </button>
        {loaderData.search && (
          <Link
            className="admin-button admin-button--quiet"
            prefetch="intent"
            to="/admin"
          >
            Clear
          </Link>
        )}
      </Form>

      {loaderData.products && (
        <section
          className="admin-card admin-product-table-card"
          aria-label="Product list"
        >
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Inventory</th>
                  <th>Metafields</th>
                  <th>Updated</th>
                  <th>
                    <span className="admin-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const image = product.featuredMedia?.preview?.image;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-cell">
                          {image ? (
                            <img alt={image.altText || ''} src={image.url} />
                          ) : (
                            <span className="admin-image-placeholder" aria-hidden="true">
                              Tea
                            </span>
                          )}
                          <span>
                            <strong>{product.title}</strong>
                            <small>/{product.handle}</small>
                            <small>{product.vendor || 'No vendor'}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`admin-status admin-status--${product.status.toLowerCase()}`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td>{product.totalInventory}</td>
                      <td>{product.metafields.nodes.length}</td>
                      <td>
                        <time dateTime={product.updatedAt}>
                          {new Date(product.updatedAt).toLocaleDateString('en-IN')}
                        </time>
                      </td>
                      <td>
                        <Link
                          className="admin-row-link"
                          prefetch="intent"
                          to={`/admin/products/${product.legacyResourceId}`}
                        >
                          Edit <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!products.length && (
            <div className="admin-empty">
              <h2>No products found</h2>
              <p>Try a broader search or clear the current filter.</p>
            </div>
          )}
        </section>
      )}

      {loaderData.products?.pageInfo.hasNextPage &&
        loaderData.products.pageInfo.endCursor && (
          <div className="admin-pagination">
            <Link
              className="admin-button"
              prefetch="intent"
              to={`?${new URLSearchParams({...(loaderData.search ? {q: loaderData.search} : {}), after: loaderData.products.pageInfo.endCursor}).toString()}`}
            >
              Next 50 products
            </Link>
          </div>
        )}
    </AdminShell>
  );
}
