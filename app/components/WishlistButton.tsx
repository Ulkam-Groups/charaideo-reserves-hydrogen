import {useWishlist, type WishlistProduct} from './WishlistProvider';

export function WishlistButton({
  product,
  className = '',
  showLabel = false,
}: {
  product: WishlistProduct;
  className?: string;
  showLabel?: boolean;
}) {
  const {includes, ready, toggle} = useWishlist();
  const saved = includes(product.id);
  const label = saved ? 'Remove from saved teas' : 'Save this tea';

  return (
    <button
      type="button"
      className={`wishlist-button${saved ? ' is-saved' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
      aria-pressed={saved}
      disabled={!ready}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(product);
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      </svg>
      {showLabel && <span>{saved ? 'Saved' : 'Save tea'}</span>}
    </button>
  );
}
