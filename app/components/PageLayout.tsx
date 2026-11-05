import {Await, Link, useLocation} from 'react-router';
import {Suspense} from 'react';
import type {CartApiQueryFragment, HeaderQuery} from 'storefrontapi.generated';
import {Aside, useAside} from '~/components/Aside';
import {Footer, MarketSelector} from '~/components/Footer';
import {
  Header,
  HeaderMenu,
} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SEARCH_ENDPOINT, SearchFormPredictive} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import type {StorefrontNotice} from '~/lib/storefront-notices';
import type {DiscountProgressData, DiscountProgressMilestone} from '~/lib/discount-progress';
import {WishlistProvider} from '~/components/WishlistProvider';
import type {StorefrontMarket} from '~/lib/markets';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  notices: StorefrontNotice[];
  header: HeaderQuery | null;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  buyerCountry: string;
  availableMarkets: StorefrontMarket[];
  cartDiscountProgress: DiscountProgressData;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  notices,
  children = null,
  header,
  isLoggedIn,
  publicStoreDomain,
  buyerCountry,
  availableMarkets,
  cartDiscountProgress,
}: PageLayoutProps) {
  const {pathname} = useLocation();
  const freeShippingMilestone =
    cartDiscountProgress.status === 'ready'
      ? cartDiscountProgress.milestones.find(
          (milestone) =>
            milestone.reward === 'Free shipping' &&
            milestone.method === 'automatic',
        )
      : undefined;

  return (
    <WishlistProvider>
    <Aside.Provider>
      <CartAside cart={cart} />
      <SearchAside />
      <MobileMenuAside
        header={header}
        publicStoreDomain={publicStoreDomain}
        buyerCountry={buyerCountry}
        availableMarkets={availableMarkets}
      />
      <NoticeBoard
        notices={notices}
        freeShippingMilestone={freeShippingMilestone}
      />
      <Header
        header={header}
        cart={cart}
        isLoggedIn={isLoggedIn}
        publicStoreDomain={publicStoreDomain}
      />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main id="main-content" className={pathname === '/' ? undefined : 'main--offset'}>{children}</main>
      <Footer buyerCountry={buyerCountry} availableMarkets={availableMarkets} />
    </Aside.Provider>
    </WishlistProvider>
  );
}

function NoticeBoard({
  notices,
  freeShippingMilestone,
}: {
  notices: StorefrontNotice[];
  freeShippingMilestone?: DiscountProgressMilestone;
}) {
  if (!notices.length) return null;

  return (
    <div className="notice-board site-notice-board">
      <div className="notice-marquee-track">
        <div className="notice-marquee-group">
          {notices.map((notice) => (
            <NoticeLink
              key={notice.id}
              notice={notice}
              freeShippingMilestone={freeShippingMilestone}
            />
          ))}
        </div>
        <div aria-hidden="true" className="notice-marquee-group">
          {notices.map((notice) => (
            <NoticeLink
              key={`duplicate-${notice.id}`}
              notice={notice}
              freeShippingMilestone={freeShippingMilestone}
              tabIndex={-1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NoticeLink({
  notice,
  freeShippingMilestone,
  tabIndex,
}: {
  notice: StorefrontNotice;
  freeShippingMilestone?: DiscountProgressMilestone;
  tabIndex?: number;
}) {
  const message = freeShippingMilestone
    ? replaceShippingThreshold(notice.message, freeShippingMilestone)
    : notice.message;
  const content = (
    <>
      <span className="chapter-announcement-message">
        <span className="chapter-announcement-signal" aria-hidden="true" />
        <span>{message}</span>
      </span>
      {notice.buttonLabel && (
        <span className="chapter-announcement-cta">{notice.buttonLabel}</span>
      )}
    </>
  );
  const className = 'chapter-announcement notice-board-item';
  const sharedProps = {
    'aria-label': notice.buttonLabel
      ? `${message}. ${notice.buttonLabel}`
      : message,
    className,
    'data-state': notice.state,
    'data-tone': notice.tone,
    tabIndex,
  };

  if (!notice.buttonLink) return <div {...sharedProps}>{content}</div>;
  if (notice.buttonLink.startsWith('/') && !notice.buttonLink.startsWith('//')) {
    return (
      <Link {...sharedProps} prefetch="none" to={notice.buttonLink}>
        {content}
      </Link>
    );
  }

  return (
    <a {...sharedProps} href={notice.buttonLink}>
      {content}
    </a>
  );
}

function replaceShippingThreshold(
  message: string,
  milestone: DiscountProgressMilestone,
) {
  const formattedThreshold = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: milestone.currencyCode,
    maximumFractionDigits: 0,
  }).format(milestone.threshold);
  return message.replace(
    /((?:free\s+(?:shipping|delivery))\s+(?:above|over)\s+)(?:₹\s*)?[\d,]+(?:\.\d{1,2})?(?:\s*\/-)?/i,
    (_match, prefix: string) => `${prefix}${formattedThreshold}`,
  );
}

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  const {close} = useAside();

  return (
    <Aside
      type="cart"
      heading={
        <Link
          className="cart-aside-heading-link"
          prefetch="none"
          to="/cart"
          onClick={close}
        >
          <span className="cart-aside-heading-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M2.75 4.75h2.1l2.15 9.1h10.7l2.15-6.6H5.55"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="18.25" r="1.25" />
              <circle cx="17" cy="18.25" r="1.25" />
            </svg>
          </span>
          <span>Cart</span>
        </Link>
      }
    >
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await
          resolve={cart}
          errorElement={<CartMain cart={null} layout="aside" />}
        >
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

function SearchAside() {
  return (
    <Aside type="search" heading="Find your tea">
      <div className="predictive-search">
        <SearchFormPredictive>
          {({fetchResults, inputRef}) => (
            <>
              <input
                aria-label="Search teas and pages"
                autoComplete="off"
                data-autofocus
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search teas, stories, and more"
                ref={inputRef}
                type="search"
              />
            </>
          )}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products} = items;

            if (!term.current) {
              return (
                <div className="predictive-search-prompt">
                  <span aria-hidden="true">✦</span>
                  <h4>Explore the reserve list</h4>
                  <p>
                    Start typing an estate, tea, collection, or story. Results
                    will appear here as you type.
                  </p>
                </div>
              );
            }

            if (state === 'loading' && term.current) {
              return (
                <p className="predictive-search-status" role="status">
                  Finding teas...
                </p>
              );
            }

            if (!total) {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            return (
              <>
                <SearchResultsPredictive.Products
                  products={products}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Collections
                  collections={collections}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Pages
                  pages={pages}
                  closeSearch={closeSearch}
                  term={term}
                />
              </>
            );
          }}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  publicStoreDomain,
  buyerCountry,
  availableMarkets,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
  buyerCountry: PageLayoutProps['buyerCountry'];
  availableMarkets: PageLayoutProps['availableMarkets'];
}) {
  const primaryDomainUrl =
    header?.shop.primaryDomain.url ?? `https://${publicStoreDomain}`;

  return (
    <Aside
      type="mobile"
      heading="Explore"
      headerActions={
        <MarketSelector
          availableMarkets={availableMarkets}
          buyerCountry={buyerCountry}
          className="mobile-menu-location"
          hideLabel
          id="mobile-market"
        />
      }
    >
      <HeaderMenu
        menu={header?.menu ?? null}
        viewport="mobile"
        primaryDomainUrl={primaryDomainUrl}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside>
  );
}
