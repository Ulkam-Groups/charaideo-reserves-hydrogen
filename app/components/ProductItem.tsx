import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useState} from 'react';
import type {
  ProductItemFragment,
  CollectionItemFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';

type CardVariant = CollectionItemFragment['variants']['nodes'][number];

type TeaProduct = (
  | CollectionItemFragment
  | ProductItemFragment
) & {
  productType?: string;
  tastingNotes?: {value: string} | null;
  selectedOrFirstAvailableVariant?: {
    id: string;
    availableForSale: boolean;
  } | null;
  variants?: {nodes: CardVariant[]};
};

export function ProductItem({
  product,
  loading = 'lazy',
  showVariants = false,
}: {
  product: TeaProduct;
  loading?: 'eager' | 'lazy';
  showVariants?: boolean;
}) {
  const url = useVariantUrl(product.handle);
  const {open} = useAside();
  const variants = product.variants?.nodes || [];
  const firstAvailableVariant = variants.find((item) => item.availableForSale);
  const [selectedVariantId, setSelectedVariantId] = useState(
    firstAvailableVariant?.id || variants[0]?.id || '',
  );
  const selectedVariant =
    variants.find((item) => item.id === selectedVariantId) ||
    firstAvailableVariant ||
    variants[0];
  const fallbackVariant = product.selectedOrFirstAvailableVariant;
  const cartVariant = selectedVariant || fallbackVariant;
  const canAddToCart = Boolean(cartVariant?.availableForSale);
  const showVariantChoices =
    showVariants &&
    (variants.length > 1 ||
      (variants.length === 1 && variants[0].title !== 'Default Title'));
  const fullDescription =
    product.description?.trim().replace(/\s+/g, ' ') ||
    product.tastingNotes?.value?.trim().replace(/\s+/g, ' ') ||
    '';
  const descriptionCharacters = Array.from(fullDescription);
  const cardDescription =
    descriptionCharacters.length > 40
      ? `${descriptionCharacters.slice(0, 40).join('').trimEnd()}...`
      : fullDescription;

  return (
    <article
      className={`catalog-card${showVariants ? ' catalog-card--commerce' : ''}`}
    >
      <Link className="catalog-card-image" prefetch="intent" to={url}>
        {product.featuredImage ? (
          <Image
            alt={product.featuredImage.altText || product.title}
            aspectRatio="4/3"
            data={product.featuredImage}
            loading={loading}
            sizes="(min-width: 1200px) 270px, (min-width: 700px) 31vw, 92vw"
          />
        ) : (
          <div className="catalog-card-placeholder" aria-hidden />
        )}
      </Link>
      <div className="catalog-card-body">
        <div className="catalog-card-heading">
          <p>{product.productType || 'The tea cabinet'}</p>
          <h2><Link to={url}>{product.title}</Link></h2>
        </div>
        <p className="catalog-card-description" title={fullDescription}>
          {cardDescription}
        </p>

        {showVariantChoices ? (
          <fieldset className="catalog-variant-picker">
            <legend>Packet size</legend>
            <div>
              {variants.map((item) => {
                const label = getPacketLabel(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.availableForSale}
                    aria-pressed={item.id === selectedVariant?.id}
                    aria-label={
                      item.availableForSale
                        ? `Select ${label}`
                        : `${label}, out of stock`
                    }
                    title={!item.availableForSale ? 'Out of stock' : undefined}
                    onClick={() => setSelectedVariantId(item.id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : showVariants ? (
          <div className="catalog-card-availability">
            <span>Availability</span>
            <strong>{canAddToCart ? 'In stock' : 'Unavailable'}</strong>
          </div>
        ) : null}

        <div className="catalog-card-footer">
          {showVariants ? (
            <div className="catalog-card-price">
              <span>{showVariantChoices && selectedVariant
                ? getPacketLabel(selectedVariant)
                : 'Price'}</span>
              <strong>
                <Money
                  data={
                    selectedVariant?.price || product.priceRange.minVariantPrice
                  }
                />
              </strong>
            </div>
          ) : (
            <Money data={product.priceRange.minVariantPrice} />
          )}

          {cartVariant ? (
            <AddToCartButton
              disabled={!canAddToCart}
              lines={
                canAddToCart
                  ? [{merchandiseId: cartVariant.id, quantity: 1}]
                  : []
              }
              onClick={() => open('cart')}
            >
              {canAddToCart ? 'Add to cart' : 'Unavailable'}
            </AddToCartButton>
          ) : (
            <Link className="text-link" to={url}>Choose tea →</Link>
          )}
        </div>
      </div>
    </article>
  );
}

function getPacketLabel(variant: CardVariant) {
  const packetOption = variant.selectedOptions.find((option) =>
    /size|weight|pack/i.test(option.name),
  );

  return packetOption?.value || variant.title;
}
