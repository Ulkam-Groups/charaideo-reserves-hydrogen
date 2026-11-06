import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {flushSync} from 'react-dom';
import {
  data,
  Link,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router';
import {Image, Money, useAnalytics} from '@shopify/hydrogen';
import type {Route} from './+types/reserve-list';
import type {loader as rootLoader} from '~/root';
import {
  chapterState,
  isAvailableForSale,
  partitionReserveCollections,
  reserveProductMetadata,
  reserveVariantLabel,
  type ReserveCollection,
} from '~/lib/reserve-list';
import {AddToCartButton} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';
import {canStartCheckout} from '~/lib/checkout/checkout';
import {startCheckout} from '~/lib/checkout/checkout.client';
import {WishlistButton} from '~/components/WishlistButton';
import {RotatingProductImage} from '~/components/RotatingProductImage';
import {breadcrumbJsonLd, canonicalUrl} from '~/lib/seo';

export const headers: Route.HeadersFunction = ({loaderHeaders}) => loaderHeaders;

type CollectionSummary = {title: string; handle: string; description: string};
type CollectionsPage = {
  collections: {
    nodes: CollectionSummary[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
};
type ProductPage = {
  collection: {
    products: {
      nodes: ReserveCollection['products'];
      pageInfo: {hasNextPage: boolean; endCursor: string | null};
    };
  } | null;
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => void;
};
export const meta: Route.MetaFunction = () => [
  {title: 'The Reserve List | Charaideo Reserves™'},
  {
    name: 'description',
    content:
      'Explore authentic luxury Assam teas, including single-origin estate reserves, from Charaideo Reserves and the House of Tea Reserves of India.',
  },
  {rel: 'canonical', href: canonicalUrl('/reserve-list')},
  {
    'script:ld+json': breadcrumbJsonLd([
      {name: 'Home', path: '/'},
      {name: 'The Reserve List', path: '/reserve-list'},
    ]),
  },
];

export async function loader({context}: Route.LoaderArgs) {
  const cache = context.storefront.CacheShort({
    maxAge: 60,
    staleWhileRevalidate: 300,
  });
  const summaries: CollectionSummary[] = [];
  let cursor: string | null = null;
  do {
    const result: CollectionsPage = await context.storefront.query(COLLECTIONS_QUERY, {
      variables: {after: cursor},
      cache,
      displayName: 'Reserve list collections',
    });
    summaries.push(...result.collections.nodes);
    cursor = result.collections.pageInfo.hasNextPage
      ? result.collections.pageInfo.endCursor
      : null;
  } while (cursor);

  // Each collection is independent. Loading them serially creates an N+1
  // waterfall that adds one Storefront API round trip per collection to TTFB.
  const collections = await Promise.all(
    summaries.map(async (summary): Promise<ReserveCollection> => {
      const products: ReserveCollection['products'] = [];
      let productCursor: string | null = null;
      do {
        const result: ProductPage = await context.storefront.query(
          COLLECTION_PRODUCTS_QUERY,
          {
            variables: {handle: summary.handle, after: productCursor},
            cache,
            displayName: `Reserve list products: ${summary.handle}`,
          },
        );
        if (!result.collection) break;
        products.push(...result.collection.products.nodes);
        productCursor = result.collection.products.pageInfo.hasNextPage
          ? result.collection.products.pageInfo.endCursor
          : null;
      } while (productCursor);
      return {...summary, products};
    }),
  );

  return data(partitionReserveCollections(collections), {
    headers: {
      'Cache-Control': 'public, max-age=10, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

const COLLECTIONS_QUERY = `#graphql
  query ReserveListCollections($after: String) {
    collections(first: 100, after: $after) {
      nodes { title handle description }
      pageInfo { hasNextPage endCursor }
    }
  }
` as const;

const COLLECTION_PRODUCTS_QUERY = `#graphql
  query ReserveListProducts($handle: String!, $after: String) {
    collection(handle: $handle) {
      products(first: 100, after: $after) {
        nodes {
          id
          title
          handle
          description
          vendor
          tags
          estate: metafield(namespace: "custom", key: "estate") { value }
          teaStyle: metafield(namespace: "custom", key: "tea_style") { value }
          flush: metafield(namespace: "custom", key: "flush") { value }
          grade: metafield(namespace: "custom", key: "grade") { value }
          availableForSale
          featuredImage { url altText width height }
          images(first: 2) { nodes { url altText width height } }
          priceRange { minVariantPrice { amount currencyCode } }
          variants(first: 25) {
            nodes {
              id
              title
              availableForSale
              selectedOptions { name value }
              price { amount currencyCode }
              product {
                id
                handle
                title
                collections(first: 20) { nodes { id } }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
` as const;

export default function ReserveList() {
  const {chapters, others} = useLoaderData<typeof loader>();
  const catalogChapters = chapters.filter((chapter) => chapter.products.length > 0);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab =
    searchParams.get('tab') === 'collections' ? 'collections' : 'chapters';
  const [tab, setTab] = useState<'chapters' | 'collections'>(requestedTab);
  const [chaptersOpen, setChaptersOpen] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [catalogNavOpen, setCatalogNavOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const discoveryRef = useRef<HTMLDivElement>(null);
  const discoverySentinelRef = useRef<HTMLSpanElement>(null);
  const [discoveryStuck, setDiscoveryStuck] = useState(false);
  const [teaStyleOpen, setTeaStyleOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const query = searchParams.get('q') ?? '';
  const [queryInput, setQueryInput] = useState(query);
  const availability = searchParams.get('availability') ?? 'all';
  const requestedChapter = searchParams.get('chapter');
  const selectedChapter =
    requestedChapter &&
    catalogChapters.some((chapter) => chapter.handle === requestedChapter)
      ? requestedChapter
      : null;
  const selectedCollections = searchParams.getAll('collection');
  const selectedTag = searchParams.get('tag');
  const sort = searchParams.get('sort') ?? 'featured';
  const minPrice = searchParams.get('min') ?? '';
  const maxPrice = searchParams.get('max') ?? '';

  useEffect(() => setTab(requestedTab), [requestedTab]);

  useEffect(() => {
    const updateStickyState = () => {
      const discovery = discoveryRef.current;
      const sentinel = discoverySentinelRef.current;
      if (!discovery || !sentinel) {
        setDiscoveryStuck(false);
        return;
      }

      const stickyTop = Number.parseFloat(getComputedStyle(discovery).top) || 0;
      setDiscoveryStuck(sentinel.getBoundingClientRect().top <= stickyTop);
    };

    updateStickyState();
    window.addEventListener('scroll', updateStickyState, {passive: true});
    window.addEventListener('resize', updateStickyState);
    return () => {
      window.removeEventListener('scroll', updateStickyState);
      window.removeEventListener('resize', updateStickyState);
    };
  }, []);
  useEffect(() => {
    if (!filtersOpen) setTeaStyleOpen(false);
  }, [filtersOpen]);
  useEffect(() => setQueryInput(query), [query]);
  useEffect(() => {
    if (queryInput === query) return;
    const timeout = window.setTimeout(() => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (queryInput) next.set('q', queryInput);
          else next.delete('q');
          return next;
        },
        {preventScrollReset: true, replace: true},
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, queryInput, setSearchParams]);
  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      document.getElementById('reserve-search')?.focus();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  useEffect(() => {
    if (!filtersOpen) return;
    const closeFilters = (event: MouseEvent | globalThis.KeyboardEvent) => {
      if (event instanceof globalThis.KeyboardEvent && event.key === 'Escape') {
        setFiltersOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        !filtersRef.current?.contains(event.target as Node)
      ) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeFilters);
    document.addEventListener('keydown', closeFilters);
    return () => {
      document.removeEventListener('pointerdown', closeFilters);
      document.removeEventListener('keydown', closeFilters);
    };
  }, [filtersOpen]);
  useEffect(() => {
    if (!sortOpen) return;
    const closeSort = (event: MouseEvent | globalThis.KeyboardEvent) => {
      if (event instanceof globalThis.KeyboardEvent && event.key === 'Escape') {
        setSortOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        !sortRef.current?.contains(event.target as Node)
      ) {
        setSortOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeSort);
    document.addEventListener('keydown', closeSort);
    return () => {
      document.removeEventListener('pointerdown', closeSort);
      document.removeEventListener('keydown', closeSort);
    };
  }, [sortOpen]);

  const updateParam = (name: string, value?: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, {preventScrollReset: true, replace: true});
  };
  const selectedCollectionData =
    selectedCollections.length === 1
      ? (others.find((collection) => collection.handle === selectedCollections[0]) ??
        null)
      : null;
  const allProducts = [...catalogChapters, ...others].flatMap(
    (collection) => collection.products,
  );
  const uniqueProducts = Array.from(
    new Map(allProducts.map((product) => [product.handle, product] as const)).values(),
  );
  const catalogPrices = uniqueProducts
    .map((product) => Number(product.priceRange?.minVariantPrice.amount))
    .filter((price) => Number.isFinite(price));
  const catalogMinPrice = catalogPrices.length
    ? Math.floor(Math.min(...catalogPrices))
    : 0;
  const catalogMaxPrice = catalogPrices.length
    ? Math.ceil(Math.max(...catalogPrices))
    : 1000;
  const selectedMinPrice = minPrice ? Number(minPrice) : catalogMinPrice;
  const selectedMaxPrice = maxPrice ? Number(maxPrice) : catalogMaxPrice;
  const priceRangeSize = Math.max(catalogMaxPrice - catalogMinPrice, 1);
  const priceRangeStart = ((selectedMinPrice - catalogMinPrice) / priceRangeSize) * 100;
  const priceRangeEnd = ((selectedMaxPrice - catalogMinPrice) / priceRangeSize) * 100;
  const formatRangePrice = (value: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  const productCollectionLabels = new Map<string, string>();
  for (const collection of others) {
    for (const product of collection.products) {
      if (!productCollectionLabels.has(product.handle))
        productCollectionLabels.set(product.handle, collection.title);
    }
  }
  const allCollectionProducts = Array.from(
    new Map(
      others
        .flatMap((collection) => collection.products)
        .map((product) => [product.handle, product] as const),
    ).values(),
  );
  const availableTags = Array.from(
    new Set(uniqueProducts.flatMap((product) => product.tags ?? [])),
  )
    .filter((tag) => Boolean(tag) && !tag.toLowerCase().startsWith('origin-label:'))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);

  const filterProducts = (products: typeof uniqueProducts) => {
    const normalizedQuery = queryInput.trim().toLowerCase();
    const floor = minPrice ? Number(minPrice) : null;
    const ceiling = maxPrice ? Number(maxPrice) : null;
    const filtered = products.filter((product) => {
      const price = Number(product.priceRange?.minVariantPrice.amount ?? 0);
      const haystack = [
        product.title,
        product.vendor,
        product.description,
        product.estate?.value,
        product.teaStyle?.value,
        product.flush?.value,
        product.grade?.value,
        ...(product.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (availability === 'all' ||
          (availability === 'in-stock'
            ? product.availableForSale
            : !product.availableForSale)) &&
        (!selectedTag || product.tags?.includes(selectedTag)) &&
        (floor === null || price >= floor) &&
        (ceiling === null || price <= ceiling)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'price-asc')
        return (
          Number(a.priceRange?.minVariantPrice.amount ?? 0) -
          Number(b.priceRange?.minVariantPrice.amount ?? 0)
        );
      if (sort === 'price-desc')
        return (
          Number(b.priceRange?.minVariantPrice.amount ?? 0) -
          Number(a.priceRange?.minVariantPrice.amount ?? 0)
        );
      if (sort === 'name') return a.title.localeCompare(b.title);
      return 0;
    });
  };

  const collectionPool = selectedCollections.length
    ? Array.from(
        new Map(
          others
            .filter((collection) => selectedCollections.includes(collection.handle))
            .flatMap((collection) => collection.products)
            .map((product) => [product.handle, product] as const),
        ).values(),
      )
    : allCollectionProducts;
  const visibleCollectionProducts = filterProducts(collectionPool);
  const visibleChapters = selectedChapter
    ? catalogChapters.filter((chapter) => chapter.handle === selectedChapter)
    : catalogChapters;
  const filteredChapters = visibleChapters
    .map((chapter) => ({...chapter, products: filterProducts(chapter.products)}))
    .filter((chapter) => chapter.products.length > 0);
  const activeFilterCount = [
    availability !== 'all',
    Boolean(selectedTag),
    Boolean(minPrice),
    Boolean(maxPrice),
  ].filter(Boolean).length;
  const clearFilters = () => {
    setQueryInput('');
    const next = new URLSearchParams(searchParams);
    ['q', 'availability', 'tag', 'min', 'max', 'sort', 'chapter', 'collection'].forEach(
      (key) => next.delete(key),
    );
    setSearchParams(next, {preventScrollReset: true, replace: true});
  };
  const selectChapter = (handle?: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'chapters');
    if (handle) next.set('chapter', handle);
    else next.delete('chapter');
    setSearchParams(next, {preventScrollReset: true, replace: true});
    setTab('chapters');
    setCatalogNavOpen(false);
  };
  const toggleCollection = (handle: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'collections');
    const handles = next.getAll('collection');
    next.delete('collection');
    const updated = handles.includes(handle)
      ? handles.filter((value) => value !== handle)
      : [...handles, handle];
    updated.forEach((value) => next.append('collection', value));
    setSearchParams(next, {preventScrollReset: true, replace: true});
    setTab('collections');
  };
  const selectTab = (nextTab: 'chapters' | 'collections') => {
    if (nextTab === tab) return;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', nextTab);
    setSearchParams(nextSearchParams, {preventScrollReset: true, replace: true});
    const transitionDocument = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!transitionDocument.startViewTransition || reduceMotion) {
      setTab(nextTab);
      return;
    }
    transitionDocument.startViewTransition(() => flushSync(() => setTab(nextTab)));
  };
  return (
    <div className="reserve-list-page">
      <div className="reserve-list-main">
        <header className="reserve-list-introduction">
          <h1>The Reserve List</h1>
          <p className="reserve-list-intro">
            Rare Assam teas, selected by estate, season, and character.
          </p>
        </header>

        <div className="reserve-catalog-shell">
          <span
            className="reserve-discovery-sentinel"
            ref={discoverySentinelRef}
            aria-hidden="true"
          />
          <div
            className={`reserve-discovery${discoveryStuck ? ' reserve-discovery--stuck' : ''}`}
            ref={discoveryRef}
          >
            <label className="reserve-search" htmlFor="reserve-search">
              <span aria-hidden="true">⌕</span>
              <input
                id="reserve-search"
                name="reserve-catalog-search"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search teas, estates, or tasting notes…"
              />
              <kbd>/</kbd>
            </label>
            <div className="reserve-filters" ref={filtersRef}>
              <button
                type="button"
                className="reserve-filter-trigger"
                aria-expanded={filtersOpen}
                aria-controls="reserve-filter-panel"
                onClick={() => {
                  setSortOpen(false);
                  setFiltersOpen((open) => !open);
                }}
              >
                <span aria-hidden="true">☷</span> Filters
                {activeFilterCount ? <b>{activeFilterCount}</b> : null}
                <i aria-hidden="true" />
              </button>
              {filtersOpen && (
                <div className="reserve-filter-panel" id="reserve-filter-panel">
                  <header>
                    <div>
                      <strong>Filter teas</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      aria-label="Close filters"
                    >
                      ×
                    </button>
                  </header>
                  <div className="reserve-filter-section">
                    <span className="reserve-filter-label">Availability</span>
                    <div className="reserve-choice-row">
                      {[
                        ['all', 'All'],
                        ['in-stock', 'In stock'],
                        ['coming-soon', 'Coming soon'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={availability === value}
                          onClick={() =>
                            updateParam('availability', value === 'all' ? null : value)
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="reserve-filter-section reserve-tag-filter">
                    <span className="reserve-filter-label">Tea style</span>
                    <div className="reserve-tag-select">
                      <button
                        type="button"
                        className="reserve-tag-trigger"
                        aria-expanded={teaStyleOpen}
                        aria-haspopup="listbox"
                        onClick={() => setTeaStyleOpen((open) => !open)}
                      >
                        <span>{selectedTag || 'All styles'}</span>
                        <i aria-hidden="true" />
                      </button>
                      {teaStyleOpen && (
                        <div
                          className="reserve-tag-menu"
                          role="listbox"
                          aria-label="Tea style"
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={!selectedTag}
                            onClick={() => {
                              updateParam('tag', null);
                              setTeaStyleOpen(false);
                            }}
                          >
                            All styles{!selectedTag && <b aria-hidden="true">✓</b>}
                          </button>
                          {availableTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              role="option"
                              aria-selected={selectedTag === tag}
                              onClick={() => {
                                updateParam('tag', tag);
                                setTeaStyleOpen(false);
                              }}
                            >
                              <span>{tag}</span>
                              {selectedTag === tag && <b aria-hidden="true">✓</b>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <fieldset className="reserve-filter-section reserve-price-range">
                    <legend className="reserve-filter-label">Price range</legend>
                    <div className="reserve-range-values">
                      <strong>{formatRangePrice(selectedMinPrice)}</strong>
                      <span>to</span>
                      <strong>{formatRangePrice(selectedMaxPrice)}</strong>
                    </div>
                    <div
                      className="reserve-range-control"
                      style={
                        {
                          '--range-start': `${Math.max(0, Math.min(priceRangeStart, 100))}%`,
                          '--range-end': `${Math.max(0, Math.min(priceRangeEnd, 100))}%`,
                        } as CSSProperties
                      }
                    >
                      <div className="reserve-range-track" aria-hidden="true" />
                      <input
                        aria-label="Minimum price"
                        type="range"
                        min={catalogMinPrice}
                        max={catalogMaxPrice}
                        step="1"
                        value={selectedMinPrice}
                        onChange={(event) => {
                          const value = Math.min(
                            Number(event.target.value),
                            selectedMaxPrice,
                          );
                          updateParam(
                            'min',
                            value === catalogMinPrice ? null : String(value),
                          );
                        }}
                      />
                      <input
                        aria-label="Maximum price"
                        type="range"
                        min={catalogMinPrice}
                        max={catalogMaxPrice}
                        step="1"
                        value={selectedMaxPrice}
                        onChange={(event) => {
                          const value = Math.max(
                            Number(event.target.value),
                            selectedMinPrice,
                          );
                          updateParam(
                            'max',
                            value === catalogMaxPrice ? null : String(value),
                          );
                        }}
                      />
                    </div>
                    <div className="reserve-range-limits">
                      <span>{formatRangePrice(catalogMinPrice)}</span>
                      <span>{formatRangePrice(catalogMaxPrice)}</span>
                    </div>
                  </fieldset>
                  <footer>
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        className="reserve-clear"
                        onClick={clearFilters}
                      >
                        Reset all
                      </button>
                    ) : (
                      <span>No filters applied</span>
                    )}
                    <button
                      type="button"
                      className="reserve-filter-done"
                      onClick={() => setFiltersOpen(false)}
                    >
                      Apply
                    </button>
                  </footer>
                </div>
              )}
            </div>
            <div className="reserve-sort" ref={sortRef}>
              <button
                type="button"
                className="reserve-sort-trigger"
                aria-expanded={sortOpen}
                aria-haspopup="listbox"
                onClick={() => {
                  setFiltersOpen(false);
                  setSortOpen((open) => !open);
                }}
              >
                <span>Sort</span>
                <strong>
                  {sort === 'price-asc'
                    ? 'Price: low to high'
                    : sort === 'price-desc'
                      ? 'Price: high to low'
                      : sort === 'name'
                        ? 'Name'
                        : 'Featured'}
                </strong>
                <i aria-hidden="true" />
              </button>
              {sortOpen && (
                <div className="reserve-sort-menu" role="listbox" aria-label="Sort teas">
                  {[
                    ['featured', 'Featured'],
                    ['price-asc', 'Price: low to high'],
                    ['price-desc', 'Price: high to low'],
                    ['name', 'Name'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={sort === value}
                      onClick={() => {
                        updateParam('sort', value === 'featured' ? null : value);
                        setSortOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      {sort === value && <b aria-hidden="true">✓</b>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="reserve-catalog-nav-trigger"
            aria-expanded={catalogNavOpen}
            aria-controls="reserve-catalog-nav"
            onClick={() => setCatalogNavOpen(true)}
          >
            <span aria-hidden="true">☷</span>
            Browse chapters &amp; collections
            {(selectedChapter || selectedCollections.length > 0) && (
              <b>{(selectedChapter ? 1 : 0) + selectedCollections.length}</b>
            )}
          </button>

          {catalogNavOpen && (
            <button
              type="button"
              className="reserve-catalog-nav-backdrop"
              aria-label="Close browse menu"
              onClick={() => setCatalogNavOpen(false)}
            />
          )}
          <aside
            className={`reserve-catalog-nav${catalogNavOpen ? ' is-open' : ''}`}
            id="reserve-catalog-nav"
            aria-label="Browse the Reserve List"
          >
            <header className="reserve-catalog-nav-header">
              <div>
                <span>Discover your tea</span>
              </div>
              <button
                type="button"
                onClick={() => setCatalogNavOpen(false)}
                aria-label="Close browse menu"
              >
                ×
              </button>
            </header>

            <section className="reserve-nav-card">
              <button
                type="button"
                className="reserve-nav-card-title"
                aria-expanded={chaptersOpen}
                aria-controls="reserve-chapter-options"
                onClick={() => {
                  setChaptersOpen((open) => !open);
                  selectChapter();
                }}
              >
                <span>
                  <strong>Shop by Chapters</strong>
                  <small>Explore every estate release</small>
                </span>
                <i aria-hidden="true" />
              </button>
              {chaptersOpen && (
                <div
                  className="reserve-nav-options"
                  id="reserve-chapter-options"
                  role="group"
                  aria-label="Choose a chapter"
                >
                  <button
                    type="button"
                    className="reserve-nav-option"
                    aria-pressed={!selectedChapter}
                    onClick={() => selectChapter()}
                  >
                    <span>All chapters</span>
                    <b>
                      {catalogChapters.reduce(
                        (total, chapter) => total + chapter.products.length,
                        0,
                      )}
                    </b>
                  </button>
                  {catalogChapters.map((chapter) => (
                    <button
                      key={chapter.handle}
                      type="button"
                      className="reserve-nav-option"
                      aria-pressed={selectedChapter === chapter.handle}
                      onClick={() => selectChapter(chapter.handle)}
                    >
                      <span>{chapter.title}</span>
                      <b>{chapter.products.length}</b>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="reserve-nav-card">
              <button
                type="button"
                className="reserve-nav-card-title"
                aria-expanded={collectionsOpen}
                aria-controls="reserve-collection-options"
                onClick={() => {
                  setCollectionsOpen((open) => !open);
                  selectTab('collections');
                }}
              >
                <span>
                  <strong>Shop by Collection</strong>
                  <small>Select one or more collections</small>
                </span>
                <i aria-hidden="true" />
              </button>
              {collectionsOpen && (
                <div
                  className="reserve-nav-options reserve-nav-checkboxes"
                  id="reserve-collection-options"
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedCollections.length === 0}
                      onChange={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('tab', 'collections');
                        next.delete('collection');
                        setSearchParams(next, {preventScrollReset: true, replace: true});
                        setTab('collections');
                      }}
                    />
                    <span>All collections</span>
                    <b>{allCollectionProducts.length}</b>
                  </label>
                  {others.map((collection) => (
                    <label key={collection.handle}>
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(collection.handle)}
                        onChange={() => toggleCollection(collection.handle)}
                      />
                      <span>{collection.title}</span>
                      <b>{collection.products.length}</b>
                    </label>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <div className="reserve-catalog-results">
            <header className="reserve-results-summary" aria-live="polite">
              <div>
                <span>
                  {tab === 'chapters' ? 'Browsing chapters' : 'Browsing collections'}
                </span>
                <strong>
                  {tab === 'chapters'
                    ? selectedChapter
                      ? catalogChapters.find(
                          (chapter) => chapter.handle === selectedChapter,
                        )?.title
                      : 'All chapters'
                    : selectedCollections.length
                      ? `${selectedCollections.length} selected`
                      : 'All collections'}
                </strong>
              </div>
              <small>
                {tab === 'chapters'
                  ? `${filteredChapters.length} chapter${filteredChapters.length === 1 ? '' : 's'}`
                  : `${visibleCollectionProducts.length} tea${visibleCollectionProducts.length === 1 ? '' : 's'}`}
              </small>
            </header>

            <section
              id="reserve-chapters-panel"
              aria-label="Chapter products"
              hidden={tab !== 'chapters'}
            >
              {filteredChapters.length ? (
                <div className="reserve-chapter-sections">
                  {filteredChapters.map((chapter) => (
                    <ReserveChapterSection
                      key={chapter.handle}
                      chapter={chapter}
                      productCollectionLabels={productCollectionLabels}
                    />
                  ))}
                </div>
              ) : (
                <div className="reserve-empty" role="status">
                  <span className="reserve-empty-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <div>
                    <strong>No teas found</strong>
                    <p>
                      Try another search or reset your filters to explore the tea library.
                    </p>
                  </div>
                  <button type="button" onClick={clearFilters}>
                    Clear search &amp; filters
                  </button>
                </div>
              )}
            </section>
            <section
              id="reserve-collections-panel"
              aria-label="Collection products"
              hidden={tab !== 'collections'}
            >
              {selectedCollectionData && (
                <header className="reserve-active-collection">
                  <div>
                    <span>Curated collection</span>
                    <h2>{selectedCollectionData.title}</h2>
                  </div>
                  <p>
                    {selectedCollectionData.description ||
                      'A considered selection from the Charaideo Reserves tea library.'}
                  </p>
                </header>
              )}
              {visibleCollectionProducts.length ? (
                <div className="reserve-products-grid reserve-products-grid--collections">
                  {visibleCollectionProducts.map((product) => (
                    <ReserveTeaCard
                      key={product.handle}
                      product={product}
                      collectionTitle={
                        selectedCollectionData?.title ||
                        productCollectionLabels.get(product.handle) ||
                        'Tea collection'
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="reserve-empty" role="status">
                  <span className="reserve-empty-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <div>
                    <strong>No teas found</strong>
                    <p>
                      Try another search or reset your filters to explore the tea library.
                    </p>
                  </div>
                  <button type="button" onClick={clearFilters}>
                    Clear search &amp; filters
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReserveChapterSection({
  chapter,
  productCollectionLabels,
}: {
  chapter: ReserveCollection;
  productCollectionLabels: Map<string, string>;
}) {
  const state = chapterState(chapter);

  return (
    <section
      className="reserve-chapter-section"
      aria-labelledby={`reserve-heading-${chapter.handle}`}
    >
      <header className="reserve-section-header">
        <div>
          <span className="reserve-chapter-kicker">Chapter archive</span>
          <h2 id={`reserve-heading-${chapter.handle}`}>
            {chapter.title}
            {state !== 'open' && (
              <span className="reserve-coming-badge">Coming soon</span>
            )}
          </h2>
          {chapter.description && <p>{chapter.description}</p>}
        </div>
      </header>
      {chapter.products.length ? (
        <div className="reserve-products-grid">
          {chapter.products.map((product) => (
            <ReserveTeaCard
              key={product.handle}
              product={product}
              collectionTitle={
                productCollectionLabels.get(product.handle) || chapter.title
              }
              lockWhenUnavailable
            />
          ))}
        </div>
      ) : (
        <p className="reserve-empty">No teas are listed in this chapter yet.</p>
      )}
    </section>
  );
}

export function ReserveTeaCard({
  product,
  collectionTitle,
  lockWhenUnavailable = false,
}: {
  product: ReserveCollection['products'][number];
  collectionTitle: string;
  lockWhenUnavailable?: boolean;
}) {
  const {open: openAside} = useAside();
  const purchasableVariants = product.variants.nodes.filter(
    (variant) => variant.availableForSale,
  );
  const [selectedVariantId, setSelectedVariantId] = useState(
    purchasableVariants[0]?.id ?? product.variants.nodes[0]?.id ?? '',
  );
  const selectedVariant =
    product.variants.nodes.find((variant) => variant.id === selectedVariantId) ??
    purchasableVariants[0];
  const originLabel = product.tags
    ?.find((tag) => tag.toLowerCase().startsWith('origin-label:'))
    ?.slice('origin-label:'.length)
    .trim();
  const tastingNotes = reserveProductMetadata(product);

  if (lockWhenUnavailable && !isAvailableForSale(product)) {
    return (
      <article className="reserve-tea-card reserve-tea-card-locked">
        <div className="reserve-tea-locked-content" aria-hidden="true">
          <div className="reserve-tea-image">
            {product.images?.nodes.length ? (
              <RotatingProductImage
                images={product.images.nodes}
                alt=""
                sizes="(min-width: 900px) 300px, (min-width: 600px) 45vw, 92vw"
              />
            ) : (
              <span>Charaideo Reserves</span>
            )}
          </div>
          <span className="reserve-tea-collection">{collectionTitle}</span>
          <h3>{product.title}</h3>
        </div>
        <div className="reserve-tea-lock-overlay">
          <span className="reserve-mystery-mark" aria-hidden="true">
            ✶
          </span>
          <strong>A new reserve is steeping</strong>
          <span>To be revealed</span>
        </div>
        <span className="reserve-visually-hidden">{product.title}, coming soon</span>
      </article>
    );
  }

  return (
    <article className="reserve-tea-card reserve-shop-card">
      {product.id && (
        <WishlistButton
          className="wishlist-button--card"
          product={{
            id: product.id,
            handle: product.handle,
            title: product.title,
            image: product.featuredImage
              ? {url: product.featuredImage.url, altText: product.featuredImage.altText}
              : null,
            price: product.priceRange?.minVariantPrice ?? null,
          }}
        />
      )}
      <Link
        to={`/products/${product.handle}`}
        className="reserve-tea-link"
        prefetch="none"
      >
        <div className="reserve-tea-image">
          {originLabel && <span className="reserve-image-badge">{originLabel}</span>}
          {product.images?.nodes.length ? (
            <RotatingProductImage
              images={product.images.nodes}
              alt={product.title}
              sizes="(min-width: 900px) 300px, (min-width: 600px) 45vw, 92vw"
            />
          ) : (
            <span aria-hidden="true">Charaideo Reserves</span>
          )}
        </div>
        <span className="reserve-tea-collection">{collectionTitle}</span>
        <h3>{product.title}</h3>
        {tastingNotes && <p className="reserve-tasting-notes">{tastingNotes}</p>}
      </Link>

      <div className="reserve-commerce-panel">
        <div className="reserve-tea-meta">
          <span className="reserve-tea-price">
            {selectedVariant?.price ? (
              <Money data={selectedVariant.price} />
            ) : product.priceRange ? (
              <>
                <small>From</small> <Money data={product.priceRange.minVariantPrice} />
              </>
            ) : null}
          </span>
          <span
            className={`reserve-availability ${product.availableForSale ? 'is-available' : ''}`}
          >
            <i aria-hidden="true" />
            {product.availableForSale ? 'In stock' : 'Unavailable'}
          </span>
        </div>

        {product.variants.nodes.length > 0 && (
          <fieldset
            className="reserve-card-variants"
            data-product-available={product.availableForSale}
          >
            <legend className="reserve-visually-hidden">Choose a pack size</legend>
            <div>
              {product.variants.nodes.map((variant) => (
                <label
                  key={variant.id}
                  data-available={variant.availableForSale}
                  data-selected={selectedVariantId === variant.id}
                >
                  <input
                    type="radio"
                    name={`card-variant-${product.handle}`}
                    value={variant.id}
                    checked={selectedVariantId === variant.id}
                    onChange={() => setSelectedVariantId(variant.id)}
                    disabled={!variant.availableForSale}
                  />
                  <span>{reserveVariantLabel(variant)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {product.availableForSale ? (
          <div className="reserve-card-actions">
            <AddToCartButton
              disabled={!selectedVariant?.availableForSale}
              lines={
                selectedVariant
                  ? [{merchandiseId: selectedVariant.id, quantity: 1, selectedVariant}]
                  : []
              }
              onClick={() => openAside('cart')}
            >
              Add to bag
            </AddToCartButton>
            <ReserveBuyNowButton variant={selectedVariant} />
          </div>
        ) : (
          <Link
            to={`/products/${product.handle}`}
            prefetch="none"
            className="reserve-unavailable-action"
          >
            View tea details
          </Link>
        )}
        <Link
          to={`/products/${product.handle}`}
          prefetch="none"
          className="reserve-card-details"
        >
          Details & tasting notes
        </Link>
      </div>
    </article>
  );
}

function ReserveBuyNowButton({
  variant,
}: {
  variant: ReserveCollection['products'][number]['variants']['nodes'][number] | undefined;
}) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const {publish} = useAnalytics();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const products = variant ? [{variantId: variant.id, quantity: 1}] : [];
  const enabled = Boolean(
    variant?.availableForSale &&
    rootData?.checkoutReady &&
    rootData.checkoutCountrySupported &&
    canStartCheckout(rootData.checkoutProvider, products),
  );

  return (
    <>
      <button
        type="button"
        className="reserve-buy-now"
        disabled={!enabled || pending}
        onClick={async () => {
          if (!variant || !rootData?.checkoutProvider) return;
          setPending(true);
          setError('');
          publish('custom_buy_now_started', {quantity: 1, variantId: variant.id});
          const utmParams = new URLSearchParams(
            [...new URLSearchParams(window.location.search)].filter(([key]) =>
              key.startsWith('utm_'),
            ),
          ).toString();
          try {
            const started = await startCheckout(rootData.checkoutProvider, {
              source: 'product',
              products,
              ...(utmParams ? {utmParams} : {}),
            });
            if (!started) {
              setError('Checkout is temporarily unavailable. Please try again.');
            }
          } finally {
            setPending(false);
          }
        }}
      >
        <span>{pending ? 'Opening checkout…' : 'Buy now'}</span>
      </button>
      {rootData && !rootData.checkoutCountrySupported && (
        <p role="status">Currently shipping within India only.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
