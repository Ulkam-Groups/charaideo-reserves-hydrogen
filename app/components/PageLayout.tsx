import {Await, Link} from 'react-router';
import {Suspense, useEffect, useState} from 'react';
import type {CartApiQueryFragment, HeaderQuery} from 'storefrontapi.generated';
import {Aside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SEARCH_ENDPOINT, SearchFormPredictive} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import type {StorefrontNotice} from '~/lib/storefront-notices';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  notices: StorefrontNotice[];
  header: HeaderQuery | null;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  notices,
  children = null,
  header,
  isLoggedIn,
  publicStoreDomain,
}: PageLayoutProps) {
  return (
    <Aside.Provider>
      <CartAside cart={cart} />
      <SearchAside />
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      <NoticeBoard notices={notices} />
      <Header
        header={header}
        cart={cart}
        isLoggedIn={isLoggedIn}
        publicStoreDomain={publicStoreDomain}
      />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main id="main-content">{children}</main>
      <Footer />
    </Aside.Provider>
  );
}

function NoticeBoard({notices}: {notices: StorefrontNotice[]}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => setActiveIndex(0), [notices.length]);

  useEffect(() => {
    if (notices.length < 2 || paused) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % notices.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [notices.length, paused]);

  if (!notices.length) return null;
  const notice = notices[activeIndex] ?? notices[0];

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
      <NoticeLink key={notice.id} notice={notice} />
    </div>
  );
}

function NoticeLink({notice}: {notice: StorefrontNotice}) {
  const content = (
    <>
      <span className="chapter-announcement-message">
        <span className="chapter-announcement-signal" aria-hidden="true" />
        <span>{notice.message}</span>
      </span>
      {notice.buttonLabel && (
        <span className="chapter-announcement-cta">{notice.buttonLabel}</span>
      )}
    </>
  );
  const className = 'chapter-announcement notice-board-item';
  const sharedProps = {
    'aria-label': notice.buttonLabel
      ? `${notice.message}. ${notice.buttonLabel}`
      : notice.message,
    className,
    'data-state': notice.state,
    'data-tone': notice.tone,
  };

  if (!notice.buttonLink) return <div {...sharedProps}>{content}</div>;
  if (notice.buttonLink.startsWith('/') && !notice.buttonLink.startsWith('//')) {
    return (
      <Link {...sharedProps} prefetch="intent" to={notice.buttonLink}>
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

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  return (
    <Aside type="cart" heading="Cart">
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
    <Aside type="search" heading="SEARCH">
      <div className="predictive-search">
        <SearchFormPredictive>
          {({fetchResults, inputRef}) => (
            <>
              <input
                aria-label="Search teas and pages"
                autoComplete="off"
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search teas, stories, and more"
                ref={inputRef}
                type="search"
              />
              <button type="submit">Search</button>
            </>
          )}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products} = items;

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
                <SearchResultsPredictive.Articles
                  articles={articles}
                  closeSearch={closeSearch}
                  term={term}
                />
                {term.current && total ? (
                  <Link
                    className="predictive-search-all"
                    onClick={closeSearch}
                    prefetch="intent"
                    to={`${SEARCH_ENDPOINT}?q=${encodeURIComponent(term.current)}`}
                  >
                    View all results for <q>{term.current}</q>{' '}
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
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
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
}) {
  const primaryDomainUrl =
    header?.shop.primaryDomain.url ?? `https://${publicStoreDomain}`;

  return (
    <Aside type="mobile" heading="MENU">
      <HeaderMenu
        menu={header?.menu ?? null}
        viewport="mobile"
        primaryDomainUrl={primaryDomainUrl}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside>
  );
}
