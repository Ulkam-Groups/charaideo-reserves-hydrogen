import {Suspense} from 'react';
import {Brand} from './Brand';
import {Await, Link, NavLink, useAsyncValue} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {menu} = header;

  return (
    <header className="header header-solid">
      <div className="header-inner">
        <Brand />
        <HeaderMenu
          menu={menu}
          viewport="desktop"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
      </div>
    </header>
  );
}

export function HeaderMenu({
  viewport,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const className = `header-menu-${viewport}`;
  const {close, open} = useAside();

  return (
    <nav className={className} aria-label="Main navigation">
      <NavLink className="header-menu-item" end onClick={close} to="/">Home</NavLink>
      <NavLink className="header-menu-item" onClick={close} to="/reserve-list">Reserve List</NavLink>
      <NavLink className="header-menu-item" onClick={close} to="/pages/about-us">About Us</NavLink>
      <NavLink className="header-menu-item" onClick={close} to="/pages/contact">Contact</NavLink>
      {viewport === 'mobile' && <NavLink className="header-menu-item" onClick={close} to="/collections/all">Shop all teas</NavLink>}
      {viewport === 'mobile' && <NavLink className="header-menu-item" onClick={close} to="/sign-in">Account</NavLink>}
      {viewport === 'mobile' && <button className="header-menu-item reset" onClick={() => open('search')} type="button">Search</button>}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  return (
    <nav className="header-ctas" role="navigation">
      <HeaderMenuMobileToggle />
      <Suspense fallback={<NavLink className="header-action" to="/sign-in">Account</NavLink>}>
        <Await resolve={isLoggedIn} errorElement={<NavLink className="header-action" to="/sign-in">Account</NavLink>}>
          {(loggedIn) => <NavLink className="header-action" prefetch="intent" to={loggedIn ? '/account' : '/sign-in'}>Account</NavLink>}
        </Await>
      </Suspense>
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-action header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
    >
      <span>Menu</span>
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button className="header-action reset" onClick={() => open('search')}>
      Search
    </button>
  );
}

function CartBadge({count}: {count: number | null}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      className="header-action header-cart"
      href="/cart"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      <span>Cart</span>
      <span className="cart-count" aria-label={`${count ?? 0} items`}>
        {count ?? '-'}
      </span>
    </a>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={null} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}
