import {Await, Link, useLocation} from 'react-router';
import {Suspense, useEffect, useState} from 'react';
import type {CartApiQueryFragment, HeaderQuery} from 'storefrontapi.generated';
import {Aside, useAside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SEARCH_ENDPOINT, SearchFormPredictive} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import type {StorefrontNotice} from '~/lib/storefront-notices';
import type {DiscountProgressData, DiscountProgressMilestone} from '~/lib/discount-progress';
import {LocaleSelector} from '~/components/LocaleSelector';
import type {LocaleKey} from '~/lib/i18n';
import {LOCALES} from '~/lib/i18n';
import {WishlistProvider} from '~/components/WishlistProvider';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  notices: StorefrontNotice[];
  header: HeaderQuery | null;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  cartDiscountProgress: DiscountProgressData;
  locale: {key: LocaleKey; languageTag: string};
  suggestedLocale: LocaleKey | null;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  notices,
  children = null,
  header,
  isLoggedIn,
  publicStoreDomain,
  cartDiscountProgress,
  locale,
  suggestedLocale,
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
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} activeLocale={locale.key} />
      <NoticeBoard
        notices={notices}
        freeShippingMilestone={freeShippingMilestone}
      />
      {suggestedLocale && suggestedLocale !== locale.key && (
        <MarketSuggestion destination={suggestedLocale} />
      )}
      <Header
        header={header}
        cart={cart}
        isLoggedIn={isLoggedIn}
        publicStoreDomain={publicStoreDomain}
        activeLocale={locale.key}
      />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main id="main-content" className={pathname === '/' ? undefined : 'main--offset'}>{children}</main>
      <Footer />
    </Aside.Provider>
    </WishlistProvider>
  );
}

function MarketSuggestion({destination}: {destination: LocaleKey}) {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const target = LOCALES[destination];
  return (
    <aside className="market-suggestion" aria-label="Country suggestion">
      <span>Shopping from {target.label}?</span>
      <form action="/locale" method="post">
        <input name="locale" type="hidden" value={destination} />
        <input name="returnTo" type="hidden" value={`${location.pathname}${location.search}`} />
        <button type="submit">Shop this market</button>
      </form>
      <button type="button" aria-label="Dismiss country suggestion" onClick={() => setDismissed(true)}>×</button>
    </aside>
  );
}

function NoticeBoard({
  notices,
  freeShippingMilestone,
}: {
  notices: StorefrontNotice[];
  freeShippingMilestone?: DiscountProgressMilestone;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setPreviousIndex(null);
  }, [notices.length]);

  useEffect(() => {
    if (notices.length < 2 || paused) return;
    const interval = window.setInterval(() => {
      setPreviousIndex(activeIndex);
      setActiveIndex((activeIndex + 1) % notices.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeIndex, notices.length, paused]);

  useEffect(() => {
    if (previousIndex === null) return;
    const timeout = window.setTimeout(() => setPreviousIndex(null), 950);
    return () => window.clearTimeout(timeout);
  }, [previousIndex]);

  if (!notices.length) return null;
  const notice = notices[activeIndex] ?? notices[0];
  const previousNotice =
    previousIndex === null ? null : (notices[previousIndex] ?? null);

  return (
    <div
      className="notice-board"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {previousNotice && previousIndex !== activeIndex && (
        <div
          aria-hidden="true"
          className="notice-board-slide notice-board-slide--outgoing"
          key={`outgoing-${previousNotice.id}`}
        >
          <NoticeLink
            notice={previousNotice}
            freeShippingMilestone={freeShippingMilestone}
            tabIndex={-1}
          />
        </div>
      )}
      <div
        className={`notice-board-slide ${
          previousNotice
            ? 'notice-board-slide--incoming'
            : 'notice-board-slide--current'
        }`}
        key={`current-${notice.id}`}
      >
        <NoticeLink notice={notice} freeShippingMilestone={freeShippingMilestone} />
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
  activeLocale,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
  activeLocale: LocaleKey;
}) {
  const primaryDomainUrl =
    header?.shop.primaryDomain.url ?? `https://${publicStoreDomain}`;

  return (
    <Aside type="mobile" heading="Explore">
      <HeaderMenu
        menu={header?.menu ?? null}
        viewport="mobile"
        primaryDomainUrl={primaryDomainUrl}
        publicStoreDomain={publicStoreDomain}
      />
      <LocaleSelector activeLocale={activeLocale} compact />
    </Aside>
  );
}
