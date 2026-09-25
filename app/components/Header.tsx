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
  header: HeaderQuery | null;
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
  const menu = header?.menu ?? null;
  const primaryDomainUrl =
    header?.shop.primaryDomain.url ?? `https://${publicStoreDomain}`;

  return (
    <header className="header header-solid">
      <div className="header-inner">
        <Brand />
        <HeaderMenu
          menu={menu}
          viewport="desktop"
          primaryDomainUrl={primaryDomainUrl}
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
  menu: HeaderQuery['menu'];
  primaryDomainUrl: string;
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const className = `header-menu-${viewport}`;
  const {close, open} = useAside();

  return (
    <nav className={className} aria-label="Main navigation">
      {viewport === 'mobile' && <NavLink className="header-menu-item" end onClick={close} to="/">Home</NavLink>}
      <NavLink className="header-menu-item" onClick={close} prefetch="intent" to="/collections/all">Shop</NavLink>
      <NavLink className="header-menu-item" onClick={close} prefetch="intent" to="/reserve-list">Reserves</NavLink>
      <NavLink className="header-menu-item" onClick={close} to="/pages/about-us">Our story</NavLink>
      <NavLink className="header-menu-item" onClick={close} to="/pages/contact">Contact</NavLink>
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
    <nav className="header-ctas" aria-label="Store tools">
      <HeaderMenuMobileToggle />
      <SearchToggle />
      <Suspense fallback={<AccountLink loggedIn={false} />}>
        <Await
          resolve={isLoggedIn}
          errorElement={<AccountLink loggedIn={false} />}
        >
          {(loggedIn) => <AccountLink loggedIn={loggedIn} />}
        </Await>
      </Suspense>
      <CartToggle cart={cart} />
    </nav>
  );
}

function AccountLink({loggedIn}: {loggedIn: boolean}) {
  const label = loggedIn ? 'View account' : 'Sign in';
  return (
    <NavLink
      aria-label={label}
      className="header-icon-button header-account"
      prefetch="intent"
      title={label}
      to={loggedIn ? '/account' : '/sign-in'}
    >
      <AccountIcon />
    </NavLink>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      aria-label="Open menu"
      className="header-icon-button header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
      title="Menu"
      type="button"
    >
      <MenuIcon />
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      aria-label="Search teas"
      className="header-search-trigger reset"
      onClick={() => open('search')}
      type="button"
    >
      <span>Search teas</span>
      <SearchIcon />
    </button>
  );
}

function CartBadge({count}: {count: number | null}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      aria-label={`Cart, ${count ?? 0} items`}
      className="header-icon-button header-cart"
      href="/cart"
      title="Cart"
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
      <CartIcon />
      <span className="cart-count" aria-hidden="true">
        {count ?? '–'}
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

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.75" cy="10.75" r="6.75" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.75 20c.7-4.1 3.1-6.15 7.25-6.15S18.55 15.9 19.25 20" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4.5 7.5h15l-1.15 10.25H5.65L4.5 7.5Z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
