import {Link} from 'react-router';
import {WishlistButton} from '~/components/WishlistButton';
import {useWishlist} from '~/components/WishlistProvider';

export const meta = () => [
  {title: 'Saved teas | Charaideo Reserves'},
  {name: 'robots', content: 'noindex,follow'},
];

export default function WishlistPage() {
  const {products, ready, authenticated} = useWishlist();

  return (
    <section className="wishlist-page">
      <header className="wishlist-hero">
        <span className="eyebrow">Your tea cabinet</span>
        <h1>Saved teas</h1>
        <p>
          {authenticated
            ? 'Your saved teas follow you whenever you sign in.'
            : 'These teas are saved on this device. Sign in to keep them across devices.'}
        </p>
      </header>

      {!ready ? (
        <p className="wishlist-status" role="status">Loading saved teas…</p>
      ) : products.length ? (
        <div className="wishlist-grid">
          {products.map((product) => (
            <article className="wishlist-card" key={product.id}>
              <Link to={`/products/${product.handle}`} prefetch="none">
                <div className="wishlist-card-image">
                  {product.image ? (
                    <img
                      src={product.image.url}
                      alt={product.image.altText || product.title}
                      loading="lazy"
                    />
                  ) : (
                    <span aria-hidden="true">Charaideo Reserves</span>
                  )}
                </div>
                <h2>{product.title}</h2>
                {product.price ? (
                  <p>
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: product.price.currencyCode,
                    }).format(Number(product.price.amount))}
                  </p>
                ) : null}
              </Link>
              <WishlistButton product={product} showLabel />
            </article>
          ))}
        </div>
      ) : (
        <div className="wishlist-empty">
          <span aria-hidden="true">♡</span>
          <h2>Your tea cabinet is empty</h2>
          <p>Save a tea from the Reserve List or any product page.</p>
          <Link prefetch="none" to="/reserve-list">Explore the Reserve List</Link>
        </div>
      )}
    </section>
  );
}
