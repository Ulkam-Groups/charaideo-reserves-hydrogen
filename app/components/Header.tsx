import {Suspense, useEffect, useRef, useState} from 'react';
import {Brand} from './Brand';
import {Await, Link, NavLink, useAsyncValue} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {LocaleSelector} from '~/components/LocaleSelector';
import type {LocaleKey} from '~/lib/i18n';

interface HeaderProps {
  header: HeaderQuery | null;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  activeLocale: LocaleKey;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
  activeLocale,
}: HeaderProps) {
  const menu = header?.menu ?? null;
  const primaryDomainUrl =
    header?.shop.primaryDomain.url ?? `https://${publicStoreDomain}`;
  const headerRef = useRef<HTMLElement>(null);
  const [isDocked, setIsDocked] = useState(false);

  useEffect(() => {
    const updateDockedState = () => {
      const headerTop =
        headerRef.current?.getBoundingClientRect().top ??
        Number.POSITIVE_INFINITY;
      setIsDocked(window.scrollY > 0 && headerTop <= 0);
    };

    updateDockedState();
    window.addEventListener('scroll', updateDockedState, {passive: true});
    return () => window.removeEventListener('scroll', updateDockedState);
  }, []);

  return (
    <header
      className={`header header-solid${isDocked ? ' header-scrolled' : ''}`}
      ref={headerRef}
    >
      <div className="header-inner">
        <Brand />
        <HeaderMenu
          menu={menu}
          viewport="desktop"
          primaryDomainUrl={primaryDomainUrl}
          publicStoreDomain={publicStoreDomain}
        />
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} activeLocale={activeLocale} />
      </div>
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderQuery['menu'];
  primaryDomainUrl: string;
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const className = `header-menu-${viewport}`;
  const {close} = useAside();

  const localizeMenuUrl = (menuUrl: string) => {
    try {
      const url = new URL(menuUrl);
      if (
        url.origin === new URL(primaryDomainUrl).origin ||
        url.hostname === publicStoreDomain
      ) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      // Relative Shopify menu URLs are already valid Hydrogen routes.
    }
    return menuUrl;
  };

  if (menu?.items.length) {
    return (
      <nav className={className} aria-label="Main navigation">
        {viewport === 'mobile' && (
          <NavLink className="header-menu-item" end onClick={close} prefetch="intent" to="/">
            Home
          </NavLink>
        )}
        {menu.items.map((item) => {
          const to = localizeMenuUrl(item.url ?? '/');
          if (viewport === 'mobile' && item.items.length) {
            return (
              <div className="mobile-library-menu" key={item.id}>
                <span className="header-menu-item">{item.title}</span>
                <div className="mobile-library-sections">
                  {item.items.map((child) => (
                    <Link key={child.id} onClick={close} prefetch="intent" to={localizeMenuUrl(child.url ?? '/')}>
                      <span>{child.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <NavLink
              className="header-menu-item"
              key={item.id}
              onClick={close}
              prefetch="intent"
              to={to}
            >
              {item.title}
            </NavLink>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={className} aria-label="Main navigation">
      <NavLink className="header-menu-item" onClick={close} prefetch="none" to="/reserve-list">Tea Library</NavLink>
      <NavLink className="header-menu-item" onClick={close} prefetch="none" to="/pages/about-us">Our story</NavLink>
      <NavLink className="header-menu-item" onClick={close} prefetch="intent" to="/pages/contact">Contact</NavLink>
    </nav>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
    </svg>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
  activeLocale,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart' | 'activeLocale'>) {
  return (
    <nav className="header-ctas" aria-label="Store tools">
      <LocaleSelector activeLocale={activeLocale} />
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
      data-tooltip={label}
      prefetch="intent"
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
      data-tooltip="Menu"
      onClick={() => open('mobile')}
      type="button"
    >
      <MenuIcon />
    </button>
  );
}

function SearchToggle() {
  useEffect(() => {
    const openFromKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.closest(
        'input, textarea, select, [contenteditable="true"]',
      );
      if (
        event.key !== '/' ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping
      ) {
        return;
      }
      event.preventDefault();
      openShopifyChat(
        document.querySelector<HTMLElement>('.header-search-trigger'),
      );
    };
    window.addEventListener('keydown', openFromKeyboard);
    return () => window.removeEventListener('keydown', openFromKeyboard);
  }, []);

  return (
    <button
      aria-label="Ask about our teas"
      className="header-search-trigger reset"
      onClick={(event) => openShopifyChat(event.currentTarget)}
      title="Ask about our teas (/)"
      type="button"
    >
      <span className="header-search-label">Ask about our teas</span>
      <kbd aria-hidden="true">/</kbd>
      <SearchIcon />
    </button>
  );
}

let shopifyChatGeometryCleanup: (() => void) | null = null;

function openShopifyChat(trigger: HTMLElement | null) {
  const chat = document.querySelector<HTMLElement & {show?: () => void}>(
    'shopify-chat',
  );
  if (!chat) return;

  const revealChat = () => {
    if (chat.hasAttribute('open') && chat.dataset.prewarming !== 'true') return;

    revealShopifyChat(chat, trigger);
  };

  if (window.scrollY > 0) {
    window.scrollTo({top: 0, behavior: 'instant'});
    revealChat();
    return;
  }

  revealChat();
}

function revealShopifyChat(
  chat: HTMLElement & {show?: () => void},
  trigger: HTMLElement | null,
) {
  if (chat.dataset.prewarming === 'true') {
    // Prewarming opens the real component while its host is hidden. Convert
    // that internal open into an explicit user open without letting the
    // warmup timer close it again.
    chat.dataset.userRequestedOpen = 'true';
    chat.removeAttribute('open');
    chat.removeAttribute('data-prewarming');
  }

  shopifyChatGeometryCleanup?.();
  shopifyChatGeometryCleanup = null;
  document.documentElement.dataset.shopifyChatOpen = 'true';

  if (trigger) {
    const headerSurface = document.querySelector<HTMLElement>('.header-inner');
    const updatePanelGeometry = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const headerRect = headerSurface?.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const panelInset = Math.min(28, Math.max(12, window.innerWidth * 0.02));
      const panelBottomInset = Math.min(
        80,
        Math.max(60, (window.innerHeight * 70) / 900),
      );
      const panelLeft = headerRect?.left ?? panelInset;
      const panelRight =
        headerRect ? viewportWidth - headerRect.right : panelInset;
      const panelTop = headerRect?.bottom ?? 92;
      const panelWidth = Math.max(1, viewportWidth - panelLeft - panelRight);
      const panelHeight = Math.max(
        1,
        window.innerHeight - panelTop - panelBottomInset,
      );
      const originX = Math.min(
        panelWidth,
        Math.max(0, triggerRect.left + triggerRect.width / 2 - panelLeft),
      );

      chat.style.setProperty('--charaideo-chat-origin-x', `${originX}px`);
      chat.style.setProperty('--charaideo-chat-panel-left', `${panelLeft}px`);
      chat.style.setProperty('--charaideo-chat-panel-right', `${panelRight}px`);
      chat.style.setProperty('--charaideo-chat-panel-top', `${panelTop}px`);
      chat.style.setProperty(
        '--charaideo-chat-panel-bottom',
        `${panelBottomInset}px`,
      );
      chat.style.setProperty(
        '--charaideo-chat-start-scale-x',
        String(Math.max(0.08, Math.min(0.42, triggerRect.width / panelWidth))),
      );
      chat.style.setProperty(
        '--charaideo-chat-start-scale-y',
        String(Math.max(0.035, Math.min(0.16, triggerRect.height / panelHeight))),
      );
    };

    const handleHeaderTransitionEnd = (event: TransitionEvent) => {
      if (event.target === headerSurface) updatePanelGeometry();
    };

    updatePanelGeometry();
    window.addEventListener('resize', updatePanelGeometry);
    window.addEventListener('scroll', updatePanelGeometry, {passive: true});
    headerSurface?.addEventListener('transitionend', handleHeaderTransitionEnd);

    const headerResizeObserver = headerSurface
      ? new ResizeObserver(updatePanelGeometry)
      : null;
    if (headerSurface) headerResizeObserver?.observe(headerSurface);

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(updatePanelGeometry);
    });

    const closeObserver = new MutationObserver(() => {
      if (chat.hasAttribute('open')) return;
      closeObserver.disconnect();
      window.removeEventListener('resize', updatePanelGeometry);
      window.removeEventListener('scroll', updatePanelGeometry);
      headerSurface?.removeEventListener(
        'transitionend',
        handleHeaderTransitionEnd,
      );
      headerResizeObserver?.disconnect();
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      if (shopifyChatGeometryCleanup === cleanup) {
        shopifyChatGeometryCleanup = null;
      }
    });
    closeObserver.observe(chat, {
      attributes: true,
      attributeFilter: ['open'],
    });

    const cleanup = () => {
      closeObserver.disconnect();
      window.removeEventListener('resize', updatePanelGeometry);
      window.removeEventListener('scroll', updatePanelGeometry);
      headerSurface?.removeEventListener(
        'transitionend',
        handleHeaderTransitionEnd,
      );
      headerResizeObserver?.disconnect();
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
    shopifyChatGeometryCleanup = cleanup;
  }

  if (!chat.hasAttribute('open')) {
    if (typeof chat.show === 'function') chat.show();
    else chat.setAttribute('open', '');
  }
}

function CartBadge({count}: {count: number | null}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();
  const cartCount = count ?? 0;

  return (
    <a
      aria-label={`Cart ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
      className="header-icon-button header-cart"
      data-tooltip="Cart"
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
      <Await resolve={cart} errorElement={<CartBadge count={0} />}>
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
  return <span aria-hidden="true" className="header-search-ai-icon" />;
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
