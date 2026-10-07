import {data, Form, Link, redirect, useNavigation, useSearchParams} from 'react-router';
import type {Route} from './+types/admin.products.$productId';
import {AdminAlert, AdminShell} from '~/components/AdminShell';
import {
  ADMIN_METAFIELD_BY_KEY,
  ADMIN_METAFIELD_DEFINITIONS,
  ADMIN_NATIVE_TRACEABILITY_FIELDS,
  isTaxonomyDefinitionApplicable,
  serializeWeightMetafieldValue,
  SHOPIFY_WEIGHT_UNITS,
  validateMetafieldValue,
} from '~/lib/admin-metafields';
import {readProtectedForm} from '~/lib/protected-write.server';
import {
  changedAdminVariants,
  getAdminProduct,
  hasAdminProductChanges,
  setAdminMetafields,
  ShopifyAdminError,
  updateAdminProduct,
  updateAdminVariants,
  type AdminMetafield,
  type MetafieldUpdateValues,
  type VariantUpdateValues,
} from '~/lib/shopify-admin.server';

export const meta: Route.MetaFunction = ({data: loaderData}) => [
  {
    title: loaderData?.product
      ? `${loaderData.product.title} | Product Studio`
      : 'Product | Product Studio',
  },
  {name: 'robots', content: 'noindex,nofollow,noarchive'},
];

export function headers() {
  return {'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive'};
}

export async function loader({context, params}: Route.LoaderArgs) {
  try {
    const product = await getAdminProduct(context.env, params.productId);
    if (!product) throw new Response('Product not found', {status: 404});
    return {product, error: null};
  } catch (error) {
    if (error instanceof Response) throw error;
    const message =
      error instanceof ShopifyAdminError ? error.message : 'Unable to load this product.';
    return data({product: null, error: message}, {status: 502});
  }
}

function requiredString(form: FormData, key: string, maximum: number) {
  const value = form.get(key);
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${key} is invalid.`);
  }
  return value.trim();
}

function optionalString(form: FormData, key: string, maximum: number) {
  const value = form.get(key);
  if (typeof value !== 'string' || value.length > maximum)
    throw new Error(`${key} is invalid.`);
  return value.trim();
}

function count(form: FormData, key: string, maximum: number) {
  const value = form.get(key);
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new Error(`${key} is invalid.`);
  const parsed = Number(value);
  if (parsed < 0 || parsed > maximum) throw new Error(`${key} is invalid.`);
  return parsed;
}

function parseVariants(form: FormData, variantCount: number): VariantUpdateValues[] {
  const variants: VariantUpdateValues[] = [];
  for (let index = 0; index < variantCount; index += 1) {
    const prefix = `variant.${index}`;
    const id = requiredString(form, `${prefix}.id`, 100);
    const price = requiredString(form, `${prefix}.price`, 32);
    const compareAtPrice = optionalString(form, `${prefix}.compareAtPrice`, 32);
    const sku = optionalString(form, `${prefix}.sku`, 255);
    const barcode = optionalString(form, `${prefix}.barcode`, 255);
    const inventoryPolicy = requiredString(form, `${prefix}.inventoryPolicy`, 16);
    if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id))
      throw new Error('Variant ID is invalid.');
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(price) ||
      (compareAtPrice && !/^\d+(?:\.\d{1,2})?$/.test(compareAtPrice))
    ) {
      throw new Error(
        'Variant prices must be positive amounts with at most two decimals.',
      );
    }
    if (!['DENY', 'CONTINUE'].includes(inventoryPolicy))
      throw new Error('Inventory policy is invalid.');
    variants.push({
      id,
      price,
      compareAtPrice: compareAtPrice || null,
      sku: sku || null,
      barcode: barcode || null,
      taxable: form.get(`${prefix}.taxable`) === 'true',
      inventoryPolicy,
    });
  }
  return variants;
}

function parseMetafields(
  form: FormData,
  metafieldCount: number,
  ownerId: string,
  current: AdminMetafield[],
  allowedNativeTaxonomyFields: ReadonlySet<string>,
) {
  const currentByIdentity = new Map(
    current.map((field) => [`${field.namespace}.${field.key}`, field]),
  );
  const updates: MetafieldUpdateValues[] = [];
  const fieldErrors: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < metafieldCount; index += 1) {
    const prefix = `metafield.${index}`;
    const namespace = optionalString(form, `${prefix}.namespace`, 255);
    const key = optionalString(form, `${prefix}.key`, 64);
    const type = optionalString(form, `${prefix}.type`, 100);
    const submittedValues = form.getAll(`${prefix}.value`);
    const submittedValue =
      type === 'list.metaobject_reference' && namespace === 'shopify'
        ? JSON.stringify(
            submittedValues.filter(
              (item): item is string => typeof item === 'string' && item.length > 0,
            ),
          )
        : optionalString(form, `${prefix}.value`, 100_000);
    const value =
      type === 'weight' && submittedValue
        ? serializeWeightMetafieldValue(
            submittedValue,
            optionalString(form, `${prefix}.unit`, 20),
          )
        : submittedValue;
    if (!namespace || !key || !type) throw new Error('Metafield identity is invalid.');
    if (
      !/^[A-Za-z0-9_$-]+$/.test(namespace) ||
      !/^[A-Za-z0-9_-]+$/.test(key) ||
      !/^[a-z0-9_.]+$/.test(type)
    ) {
      throw new Error('Metafield namespace, key, or type is invalid.');
    }
    const identity = `${namespace}.${key}`;
    if (seen.has(identity)) throw new Error(`Duplicate metafield ${identity}.`);
    seen.add(identity);
    const existing = currentByIdentity.get(identity);
    if (!existing && (!value || value === '[]')) continue;
    if (existing?.value === value) continue;
    if (namespace === 'shopify' && !allowedNativeTaxonomyFields.has(identity)) {
      fieldErrors.push(
        `${
          ADMIN_NATIVE_TRACEABILITY_FIELDS.find(
            (field) => `${field.namespace}.${field.key}` === identity,
          )?.label ?? identity
        }: choose a compatible Shopify product category and save it before editing this taxonomy field.`,
      );
      continue;
    }
    const validation = validateMetafieldValue(type, value, key);
    if (validation) {
      fieldErrors.push(
        `${ADMIN_METAFIELD_BY_KEY.get(key)?.label ?? identity}: ${validation}`,
      );
      continue;
    }
    updates.push({
      ownerId,
      namespace,
      key,
      type,
      value,
      ...(typeof existing?.compareDigest === 'string'
        ? {compareDigest: existing.compareDigest}
        : {}),
    });
  }
  if (fieldErrors.length) throw new Error(fieldErrors.join(' '));
  return updates;
}

export async function action({request, context, params}: Route.ActionArgs) {
  const form = await readProtectedForm(request, {methods: ['POST'], maxBytes: 1_500_000});
  if (form instanceof Response) return form;
  let wroteAnything = false;
  try {
    const product = await getAdminProduct(context.env, params.productId);
    if (!product) throw new Response('Product not found', {status: 404});
    const title = requiredString(form, 'title', 255);
    const handle = requiredString(form, 'handle', 255);
    const status = requiredString(form, 'status', 16);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))
      throw new Error('Handle can contain lowercase letters, numbers, and hyphens.');
    if (!['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(status))
      throw new Error('Product status is invalid.');
    const variantCount = count(form, 'variantCount', 100);
    const metafieldCount = count(form, 'metafieldCount', 250);
    const variants = parseVariants(form, variantCount);
    const tags = optionalString(form, 'tags', 5_000)
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.some((tag) => tag.length > 255))
      throw new Error('Each tag must be 255 characters or fewer.');
    const category = optionalString(form, 'category', 100);
    if (category && !/^gid:\/\/shopify\/TaxonomyCategory\/.+$/.test(category)) {
      throw new Error('Category must be a Shopify TaxonomyCategory GID.');
    }
    const categoryIsUnchanged = category === (product.category?.id ?? '');
    const targetAncestorIds = categoryIsUnchanged
      ? (product.category?.ancestorIds ?? [])
      : [];
    const allowedNativeTaxonomyFields = new Set(
      product.taxonomyMetafieldDefinitions
        .filter((definition) =>
          isTaxonomyDefinitionApplicable(
            definition.constraints,
            category || null,
            targetAncestorIds,
          ),
        )
        .map((definition) => `${definition.namespace}.${definition.key}`),
    );
    const metafields = parseMetafields(
      form,
      metafieldCount,
      product.id,
      product.metafields.nodes,
      allowedNativeTaxonomyFields,
    );

    const productUpdate = {
      id: product.id,
      title,
      handle,
      descriptionHtml: optionalString(form, 'descriptionHtml', 1_000_000),
      vendor: optionalString(form, 'vendor', 255),
      productType: optionalString(form, 'productType', 255),
      status,
      tags,
      templateSuffix: optionalString(form, 'templateSuffix', 255),
      seo: {
        title: optionalString(form, 'seoTitle', 255),
        description: optionalString(form, 'seoDescription', 320),
      },
      ...(category ? {category} : {}),
    };
    const changedVariants = changedAdminVariants(product.variants.nodes, variants);

    if (hasAdminProductChanges(product, productUpdate)) {
      await updateAdminProduct(context.env, productUpdate);
      wroteAnything = true;
    }
    if (changedVariants.length) {
      await updateAdminVariants(context.env, product.id, changedVariants);
      wroteAnything = true;
    }
    if (metafields.length) {
      const result = await setAdminMetafields(context.env, metafields);
      wroteAnything = wroteAnything || result.updated > 0;
      if (result.failures.length) {
        throw new ShopifyAdminError(
          `Metafield update failed: ${result.failures.join(' ')}`,
          'VALIDATION_FAILED',
        );
      }
    }
    throw redirect(
      `/admin/products/${params.productId}?saved=${wroteAnything ? '1' : '0'}`,
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    const message =
      error instanceof Error ? error.message : 'Unable to save the product.';
    return data(
      {
        error: `${message}${wroteAnything ? ' Some earlier sections may already have been saved; reload before retrying.' : ''}`,
      },
      {
        status:
          error instanceof ShopifyAdminError && error.code === 'VALIDATION_FAILED'
            ? 422
            : 400,
      },
    );
  }
}

function MetafieldInput({
  field,
  index,
}: {
  field: AdminMetafield & {
    label: string;
    multiline?: boolean;
    options?: Array<{id: string; name: string}>;
  };
  index: number;
}) {
  const inputId = `metafield-${index}`;
  const isLong =
    field.multiline || field.type === 'json' || field.type.startsWith('list.');
  let weightValue = '';
  let weightUnit: (typeof SHOPIFY_WEIGHT_UNITS)[number] = 'GRAMS';
  if (field.type === 'weight' && field.value) {
    try {
      const parsed = JSON.parse(field.value) as {value?: unknown; unit?: unknown};
      if (typeof parsed.value === 'number') weightValue = String(parsed.value);
      if (
        typeof parsed.unit === 'string' &&
        SHOPIFY_WEIGHT_UNITS.includes(
          parsed.unit as (typeof SHOPIFY_WEIGHT_UNITS)[number],
        )
      ) {
        weightUnit = parsed.unit as (typeof SHOPIFY_WEIGHT_UNITS)[number];
      }
    } catch {
      // Keep the controls empty when a legacy value isn't valid Shopify weight JSON.
    }
  }
  return (
    <div className={isLong ? 'admin-field admin-field--wide' : 'admin-field'}>
      <label htmlFor={inputId}>{field.label}</label>
      <span className="admin-field-meta">
        {field.namespace}.{field.key} · {field.type}
      </span>
      <input
        name={`metafield.${index}.namespace`}
        type="hidden"
        value={field.namespace}
      />
      <input name={`metafield.${index}.key`} type="hidden" value={field.key} />
      <input name={`metafield.${index}.type`} type="hidden" value={field.type} />
      {field.options ? (
        <select
          defaultValue={parseReferenceList(field.value)}
          id={inputId}
          multiple
          name={`metafield.${index}.value`}
          size={Math.min(Math.max(field.options.length, 3), 8)}
        >
          {field.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      ) : field.type === 'weight' ? (
        <div className="admin-measurement-field">
          <input
            defaultValue={weightValue}
            id={inputId}
            inputMode="decimal"
            min="0.001"
            name={`metafield.${index}.value`}
            placeholder="100"
            step="any"
            type="number"
          />
          <select
            aria-label={`${field.label} unit`}
            defaultValue={weightUnit}
            name={`metafield.${index}.unit`}
          >
            <option value="GRAMS">g</option>
            <option value="KILOGRAMS">kg</option>
            <option value="OUNCES">oz</option>
            <option value="POUNDS">lb</option>
          </select>
        </div>
      ) : isLong ? (
        <textarea
          id={inputId}
          name={`metafield.${index}.value`}
          rows={field.type === 'json' ? 8 : 4}
          defaultValue={field.value}
          placeholder={
            field.type === 'list.metaobject_reference'
              ? '["gid://shopify/TaxonomyValue/123456789"]'
              : undefined
          }
        />
      ) : (
        <input
          id={inputId}
          name={`metafield.${index}.value`}
          type={
            field.type === 'date'
              ? 'date'
              : field.type === 'number_integer'
                ? 'number'
                : 'text'
          }
          min={ADMIN_METAFIELD_BY_KEY.get(field.key)?.min}
          max={ADMIN_METAFIELD_BY_KEY.get(field.key)?.max}
          defaultValue={field.value}
        />
      )}
    </div>
  );
}

function parseReferenceList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export default function AdminProductEditor({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const product = loaderData.product;
  if (!product)
    return (
      <AdminShell>
        <AdminAlert tone="critical">{loaderData.error}</AdminAlert>
      </AdminShell>
    );

  const currentByKey = new Map(
    product.metafields.nodes
      .filter((field) => field.namespace === 'custom')
      .map((field) => [field.key, field]),
  );
  const knownFields = ADMIN_METAFIELD_DEFINITIONS.map((definition) => ({
    id: currentByKey.get(definition.key)?.id ?? '',
    namespace: 'custom',
    key: definition.key,
    type: currentByKey.get(definition.key)?.type ?? definition.type,
    value: currentByKey.get(definition.key)?.value ?? '',
    compareDigest: currentByKey.get(definition.key)?.compareDigest ?? null,
    updatedAt: currentByKey.get(definition.key)?.updatedAt ?? '',
    definition: currentByKey.get(definition.key)?.definition ?? null,
    label: definition.label,
    multiline: definition.multiline,
    group: definition.group,
  }));
  const taxonomyDefinitionByIdentity = new Map(
    product.taxonomyMetafieldDefinitions.map((definition) => [
      `${definition.namespace}.${definition.key}`,
      definition,
    ]),
  );
  const nativeTraceabilityFields = ADMIN_NATIVE_TRACEABILITY_FIELDS.flatMap(
    (definition) => {
      const identity = `${definition.namespace}.${definition.key}`;
      const metafieldDefinition = taxonomyDefinitionByIdentity.get(identity);
      if (
        !metafieldDefinition ||
        !isTaxonomyDefinitionApplicable(
          metafieldDefinition.constraints,
          product.category?.id,
          product.category?.ancestorIds,
        )
      ) {
        return [];
      }
      const current = product.metafields.nodes.find(
        (field) =>
          field.namespace === definition.namespace && field.key === definition.key,
      );
      const attribute = product.category?.attributes.nodes.find(
        (candidate) =>
          candidate.name.toLocaleLowerCase() ===
          metafieldDefinition.name.toLocaleLowerCase(),
      );
      return [
        {
          id: current?.id ?? '',
          namespace: definition.namespace,
          key: definition.key,
          type: current?.type ?? metafieldDefinition.type.name ?? definition.type,
          value: current?.value ?? '',
          compareDigest: current?.compareDigest ?? null,
          updatedAt: current?.updatedAt ?? '',
          definition: current?.definition ?? null,
          label: definition.label,
          multiline: definition.multiline,
          group: definition.group,
          options: attribute?.values?.nodes ?? [],
        },
      ];
    },
  );
  const nativeTaxonomyUnavailable =
    nativeTraceabilityFields.length < ADMIN_NATIVE_TRACEABILITY_FIELDS.length;
  const knownIdentities = new Set([
    ...knownFields.map((field) => `${field.namespace}.${field.key}`),
    ...ADMIN_NATIVE_TRACEABILITY_FIELDS.map((field) => `${field.namespace}.${field.key}`),
  ]);
  const otherFields = product.metafields.nodes
    .filter((field) => !knownIdentities.has(`${field.namespace}.${field.key}`))
    .map((field) => ({
      ...field,
      label: field.definition?.name || `${field.namespace}.${field.key}`,
      multiline: true,
      group: 'Other' as const,
    }));
  const allFields = [...knownFields, ...nativeTraceabilityFields, ...otherFields];
  const busy = navigation.state === 'submitting';
  const currency = product.priceRangeV2.minVariantPrice.currencyCode;

  return (
    <AdminShell>
      <Form method="post" className="admin-editor">
        <input name="variantCount" type="hidden" value={product.variants.nodes.length} />
        <input name="metafieldCount" type="hidden" value={allFields.length} />
        <div className="admin-editor-bar">
          <div>
            <Link className="admin-back-link" prefetch="intent" to="/admin">
              ← Products
            </Link>
            <h1>{product.title}</h1>
            <p>Last updated {new Date(product.updatedAt).toLocaleString('en-IN')}</p>
          </div>
          <button
            className="admin-button admin-button--primary"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </div>

        {searchParams.get('saved') === '1' && (
          <AdminAlert tone="success">Your changed product fields were saved.</AdminAlert>
        )}
        {searchParams.get('saved') === '0' && (
          <AdminAlert>No changes were detected.</AdminAlert>
        )}
        {actionData?.error && <AdminAlert tone="critical">{actionData.error}</AdminAlert>}

        <div className="admin-editor-layout">
          <div className="admin-editor-primary">
            <section className="admin-card admin-form-section">
              <div className="admin-section-heading">
                <div>
                  <h2>Product details</h2>
                  <p>Core catalog information shown across Shopify.</p>
                </div>
                <span
                  className={`admin-status admin-status--${product.status.toLowerCase()}`}
                >
                  {product.status}
                </span>
              </div>
              <div className="admin-form-grid">
                <div className="admin-field admin-field--wide">
                  <label htmlFor="title">Title</label>
                  <input
                    defaultValue={product.title}
                    id="title"
                    maxLength={255}
                    name="title"
                    required
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="handle">Handle</label>
                  <input
                    defaultValue={product.handle}
                    id="handle"
                    name="handle"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="status">Status</label>
                  <select defaultValue={product.status} id="status" name="status">
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="vendor">Vendor</label>
                  <input defaultValue={product.vendor} id="vendor" name="vendor" />
                </div>
                <div className="admin-field">
                  <label htmlFor="productType">Product type</label>
                  <input
                    defaultValue={product.productType}
                    id="productType"
                    name="productType"
                  />
                </div>
                <div className="admin-field admin-field--wide">
                  <label htmlFor="descriptionHtml">Description HTML</label>
                  <textarea
                    defaultValue={product.descriptionHtml}
                    id="descriptionHtml"
                    name="descriptionHtml"
                    rows={10}
                  />
                  <span className="admin-help">
                    HTML is stored as entered. Preview the storefront after saving.
                  </span>
                </div>
                <div className="admin-field admin-field--wide">
                  <label htmlFor="tags">Tags</label>
                  <input defaultValue={product.tags.join(', ')} id="tags" name="tags" />
                  <span className="admin-help">Separate tags with commas.</span>
                </div>
                <div className="admin-field">
                  <label htmlFor="templateSuffix">Template suffix</label>
                  <input
                    defaultValue={product.templateSuffix || ''}
                    id="templateSuffix"
                    name="templateSuffix"
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="category">Shopify category</label>
                  <select
                    defaultValue={product.category?.id || ''}
                    id="category"
                    name="category"
                  >
                    {!product.category && <option value="">No category assigned</option>}
                    {product.category &&
                      !product.taxonomyCategories.some(
                        (category) => category.id === product.category?.id,
                      ) && (
                        <option value={product.category.id}>
                          {product.category.fullName}
                        </option>
                      )}
                    {product.taxonomyCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.fullName}
                      </option>
                    ))}
                  </select>
                  <span className="admin-help">
                    Tea format and taste profile depend on this category. Save a category
                    change before editing them.
                  </span>
                </div>
              </div>
            </section>

            <section className="admin-card admin-form-section">
              <div className="admin-section-heading">
                <div>
                  <h2>Search listing</h2>
                  <p>SEO title and description.</p>
                </div>
              </div>
              <div className="admin-form-grid">
                <div className="admin-field admin-field--wide">
                  <label htmlFor="seoTitle">SEO title</label>
                  <input
                    defaultValue={product.seo.title || ''}
                    id="seoTitle"
                    maxLength={255}
                    name="seoTitle"
                  />
                </div>
                <div className="admin-field admin-field--wide">
                  <label htmlFor="seoDescription">SEO description</label>
                  <textarea
                    defaultValue={product.seo.description || ''}
                    id="seoDescription"
                    maxLength={320}
                    name="seoDescription"
                    rows={4}
                  />
                </div>
              </div>
            </section>

            <section className="admin-card admin-form-section">
              <div className="admin-section-heading">
                <div>
                  <h2>Variants</h2>
                  <p>Price, SKU, barcode, tax, and overselling policy.</p>
                </div>
                <span>
                  {product.variants.nodes.length} variant
                  {product.variants.nodes.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="admin-variant-list">
                {product.variants.nodes.map((variant, index) => (
                  <fieldset className="admin-variant" key={variant.id}>
                    <legend>{variant.title}</legend>
                    <input
                      name={`variant.${index}.id`}
                      type="hidden"
                      value={variant.id}
                    />
                    <div className="admin-form-grid admin-form-grid--variants">
                      <div className="admin-field">
                        <label htmlFor={`variant-price-${index}`}>
                          Price ({currency})
                        </label>
                        <input
                          defaultValue={variant.price}
                          id={`variant-price-${index}`}
                          inputMode="decimal"
                          name={`variant.${index}.price`}
                          required
                        />
                      </div>
                      <div className="admin-field">
                        <label htmlFor={`variant-compare-${index}`}>
                          Compare-at price
                        </label>
                        <input
                          defaultValue={variant.compareAtPrice || ''}
                          id={`variant-compare-${index}`}
                          inputMode="decimal"
                          name={`variant.${index}.compareAtPrice`}
                        />
                      </div>
                      <div className="admin-field">
                        <label htmlFor={`variant-sku-${index}`}>SKU</label>
                        <input
                          defaultValue={variant.sku || ''}
                          id={`variant-sku-${index}`}
                          name={`variant.${index}.sku`}
                        />
                      </div>
                      <div className="admin-field">
                        <label htmlFor={`variant-barcode-${index}`}>Barcode</label>
                        <input
                          defaultValue={variant.barcode || ''}
                          id={`variant-barcode-${index}`}
                          name={`variant.${index}.barcode`}
                        />
                      </div>
                      <div className="admin-field">
                        <label htmlFor={`variant-policy-${index}`}>
                          When out of stock
                        </label>
                        <select
                          defaultValue={variant.inventoryPolicy}
                          id={`variant-policy-${index}`}
                          name={`variant.${index}.inventoryPolicy`}
                        >
                          <option value="DENY">Stop selling</option>
                          <option value="CONTINUE">Continue selling</option>
                        </select>
                      </div>
                      <label className="admin-checkbox">
                        <input
                          defaultChecked={variant.taxable}
                          name={`variant.${index}.taxable`}
                          type="checkbox"
                          value="true"
                        />{' '}
                        Charge tax
                      </label>
                    </div>
                    <p className="admin-help">
                      Inventory: {variant.inventoryQuantity ?? 'not tracked'} ·{' '}
                      {variant.selectedOptions
                        .map(({name, value}) => `${name}: ${value}`)
                        .join(' · ') || 'Default option'}
                    </p>
                  </fieldset>
                ))}
              </div>
            </section>

            {(['Taste profile', 'Editorial', 'Traceability'] as const).map((group) => (
              <section className="admin-card admin-form-section" key={group}>
                <div className="admin-section-heading">
                  <div>
                    <h2>{group}</h2>
                    <p>
                      {group === 'Traceability'
                        ? 'Tea provenance and preparation data. SKU is under Variants; Shopify category is under Product details.'
                        : 'Storefront-readable product metafields in the custom namespace.'}
                    </p>
                  </div>
                </div>
                {group === 'Traceability' && nativeTaxonomyUnavailable && (
                  <AdminAlert tone="warning">
                    Tea format and Taxonomy taste profile are unavailable for{' '}
                    {product.category?.fullName || 'a product without a category'}. Choose
                    a compatible Tea category above, save, and then select their Shopify
                    taxonomy values.
                  </AdminAlert>
                )}
                <div className="admin-form-grid">
                  {allFields.map((field, index) =>
                    field.group === group ? (
                      <MetafieldInput
                        field={field}
                        index={index}
                        key={`${field.namespace}.${field.key}`}
                      />
                    ) : null,
                  )}
                </div>
              </section>
            ))}

            {otherFields.length > 0 && (
              <section className="admin-card admin-form-section">
                <div className="admin-section-heading">
                  <div>
                    <h2>Other metafields</h2>
                    <p>Additional fields already attached to this product.</p>
                  </div>
                </div>
                <div className="admin-form-grid">
                  {allFields.map((field, index) =>
                    field.group === 'Other' ? (
                      <MetafieldInput
                        field={field}
                        index={index}
                        key={`${field.namespace}.${field.key}`}
                      />
                    ) : null,
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="admin-editor-aside" aria-label="Product summary">
            <section className="admin-card admin-summary-card">
              <h2>Snapshot</h2>
              <dl>
                <div>
                  <dt>Inventory</dt>
                  <dd>{product.totalInventory}</dd>
                </div>
                <div>
                  <dt>Price range</dt>
                  <dd>
                    {currency} {product.priceRangeV2.minVariantPrice.amount}
                    {product.priceRangeV2.minVariantPrice.amount !==
                    product.priceRangeV2.maxVariantPrice.amount
                      ? `–${product.priceRangeV2.maxVariantPrice.amount}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt>Collections</dt>
                  <dd>{product.collections.nodes.length}</dd>
                </div>
                <div>
                  <dt>Media</dt>
                  <dd>{product.media.nodes.length}</dd>
                </div>
                <div>
                  <dt>Metafields</dt>
                  <dd>{product.metafields.nodes.length}</dd>
                </div>
              </dl>
            </section>
            {product.media.nodes[0]?.preview?.image && (
              <img
                className="admin-card admin-product-preview"
                alt={product.media.nodes[0].preview.image.altText || product.title}
                src={product.media.nodes[0].preview.image.url}
              />
            )}
            <section className="admin-card admin-summary-card">
              <h2>Collections</h2>
              {product.collections.nodes.length ? (
                <ul>
                  {product.collections.nodes.map((collection) => (
                    <li key={collection.id}>{collection.title}</li>
                  ))}
                </ul>
              ) : (
                <p>Not assigned to a collection.</p>
              )}
            </section>
          </aside>
        </div>
      </Form>
    </AdminShell>
  );
}
