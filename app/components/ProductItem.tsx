import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {ProductItemFragment, CollectionItemFragment, RecommendedProductFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
type TeaProduct = (CollectionItemFragment | ProductItemFragment | RecommendedProductFragment) & {
  productType?: string;
  tastingNotes?: {value: string} | null;
  selectedOrFirstAvailableVariant?: {id: string; availableForSale: boolean} | null;
};
export function ProductItem({product, loading = 'lazy'}: {product: TeaProduct; loading?: 'eager' | 'lazy'}) {
  const url = useVariantUrl(product.handle);
  const {open} = useAside();
  const variant = product.selectedOrFirstAvailableVariant;
  return <article className="catalog-card">
    <Link className="catalog-card-image" prefetch="intent" to={url}>{product.featuredImage ? <Image alt={product.featuredImage.altText || product.title} aspectRatio="4/5" data={product.featuredImage} loading={loading} sizes="(min-width: 1000px) 23vw, (min-width: 600px) 46vw, 90vw" /> : <div className="catalog-card-placeholder" />}</Link>
    <div className="catalog-card-body"><div><p>{product.productType || 'The tea cabinet'}</p><h2><Link to={url}>{product.title}</Link></h2></div>
      {product.tastingNotes?.value && <p className="catalog-card-description">{product.tastingNotes.value}</p>}
      <div className="catalog-card-footer"><Money data={product.priceRange.minVariantPrice} />{variant ? <AddToCartButton disabled={!variant.availableForSale} lines={[{merchandiseId: variant.id, quantity: 1}]} onClick={() => open('cart')}>{variant.availableForSale ? 'Add to cart +' : 'Sold out'}</AddToCartButton> : <Link className="text-link" to={url}>Choose tea ?</Link>}</div>
    </div>
  </article>;
}
