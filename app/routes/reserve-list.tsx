import {useState} from 'react';
import {data, Link, useLoaderData} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {Route} from './+types/reserve-list';
import {chapterState, isAvailableForSale, partitionReserveCollections, type ReserveCollection} from '~/lib/reserve-list';
import reserveListStylesheet from '~/assets/reserve-list.css?url';

export const links = () => [{rel: 'stylesheet', href: reserveListStylesheet}];

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

export const meta: Route.MetaFunction = () => [
  {title: 'The Reserve List | Charaideo Reserves™'},
  {name: 'description', content: 'Explore the chapters and collections of Charaideo Reserves™.'},
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
    cursor = result.collections.pageInfo.hasNextPage ? result.collections.pageInfo.endCursor : null;
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
          title
          handle
          availableForSale
          featuredImage { url altText width height }
          priceRange { minVariantPrice { amount currencyCode } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
` as const;

export default function ReserveList() {
  const {chapters, others} = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<'chapters' | 'collections'>('collections');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const visibleCollections = selectedCollection
    ? others.filter((collection) => collection.handle === selectedCollection)
    : others;
  const productCollectionLabels = new Map<string, string>();
  for (const collection of others) {
    for (const product of collection.products) {
      if (!productCollectionLabels.has(product.handle)) {
        productCollectionLabels.set(product.handle, collection.title);
      }
    }
  }

  return (
    <div className="reserve-list-page">
      <div className="reserve-list-main">
        <p className="reserve-list-eyebrow">Library • {chapters.length} chapters • Permanent</p>
        <h1>The Reserve List</h1>
        <p className="reserve-list-intro">Where the library lives.</p>
        <div className="reserve-list-tabs" role="tablist" aria-label="Reserve List sections">
          <button type="button" role="tab" id="reserve-chapters-tab" aria-selected={tab === 'chapters'} aria-controls="reserve-chapters-panel" onClick={() => setTab('chapters')}>Chapters</button>
          <button type="button" role="tab" id="reserve-collections-tab" aria-selected={tab === 'collections'} aria-controls="reserve-collections-panel" onClick={() => setTab('collections')}>Collections</button>
        </div>
        <section id="reserve-chapters-panel" role="tabpanel" aria-labelledby="reserve-chapters-tab" hidden={tab !== 'chapters'}>
          <div className="reserve-chapter-sections">
            {chapters.map((chapter) => <ReserveChapterSection key={chapter.handle} chapter={chapter} productCollectionLabels={productCollectionLabels} />)}
            {!chapters.length && <p className="reserve-empty">No chapters are listed yet.</p>}
          </div>
        </section>
        <section id="reserve-collections-panel" role="tabpanel" aria-labelledby="reserve-collections-tab" hidden={tab !== 'collections'}>
          <div className="reserve-filter-chips" role="group" aria-label="Filter by collection">
            <button type="button" aria-pressed={selectedCollection === null} onClick={() => setSelectedCollection(null)}>All</button>
            {others.map((collection) => <button key={collection.handle} type="button" aria-pressed={selectedCollection === collection.handle} onClick={() => setSelectedCollection(collection.handle)}>{collection.title} <span className="reserve-chip-count">{collection.products.length}</span></button>)}
          </div>
          <div className="reserve-collection-sections">
            {visibleCollections.map((collection) => <ReserveCollectionSection key={collection.handle} collection={collection} />)}
            {!others.length && <p className="reserve-empty">No other collections are listed yet.</p>}
          </div>
          <div className="reserve-collection-note">
            <p>Collections can contain teas from different Chapters.</p>
            <p>Chapter = where the tea comes from (estate). Collection = what kind of tea or curation it is.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReserveChapterSection({chapter, productCollectionLabels}: {
  chapter: ReserveCollection;
  productCollectionLabels: Map<string, string>;
}) {
  const state = chapterState(chapter);
  const availableCount = chapter.products.filter(isAvailableForSale).length;

  return <section className="reserve-chapter-section" aria-labelledby={`reserve-heading-${chapter.handle}`}>
    <header className="reserve-section-header">
      <div>
        <span className="reserve-chapter-kicker">Chapter archive</span>
        <h2 id={`reserve-heading-${chapter.handle}`}>{chapter.title}{state !== 'open' && <span className="reserve-coming-badge">Coming soon</span>}</h2>
        <p>{chapter.description || `${availableCount} ${availableCount === 1 ? 'expression' : 'expressions'} available`}</p>
      </div>
      <span>{availableCount} {availableCount === 1 ? 'tea' : 'teas'} available</span>
    </header>
    {chapter.products.length ? <div className="reserve-products-grid">
      {chapter.products.map((product) => <ReserveTeaCard key={product.handle} product={product} collectionTitle={productCollectionLabels.get(product.handle) || chapter.title} lockWhenUnavailable />)}
    </div> : <p className="reserve-empty">No teas are listed in this chapter yet.</p>}
  </section>;
}

function ReserveCollectionSection({collection}: {collection: ReserveCollection}) {
  return <section className="reserve-collection-section" aria-labelledby={`reserve-heading-${collection.handle}`}>
    <header className="reserve-section-header">
      <div>
        <h2 id={`reserve-heading-${collection.handle}`}>{collection.title}</h2>
        <p>{collection.products.length} {collection.products.length === 1 ? 'expression' : 'expressions'}</p>
      </div>
      <span>Curated from the tea library</span>
    </header>
    {collection.products.length ? <div className="reserve-products-grid">
      {collection.products.map((product) => <ReserveTeaCard key={product.handle} product={product} collectionTitle={collection.title} />)}
    </div> : <p className="reserve-empty">No teas are listed in this collection yet.</p>}
  </section>;
}

function ReserveTeaCard({product, collectionTitle, lockWhenUnavailable = false}: {
  product: ReserveCollection['products'][number];
  collectionTitle: string;
  lockWhenUnavailable?: boolean;
}) {
  if (lockWhenUnavailable && !isAvailableForSale(product)) {
    return <article className="reserve-tea-card reserve-tea-card-locked">
      <div className="reserve-tea-locked-content" aria-hidden="true">
        <div className="reserve-tea-image">{product.featuredImage
          ? <Image data={product.featuredImage} alt="" loading="lazy" sizes="(min-width: 900px) 220px, (min-width: 600px) 45vw, 85vw" />
          : <span>Charaideo Reserves</span>}</div>
        <span className="reserve-tea-collection">{collectionTitle}</span>
        <h3>{product.title}</h3>
      </div>
      <div className="reserve-tea-lock-overlay">
        <span className="reserve-tea-lock" aria-hidden="true">🔒</span>
        <strong>Archive locked</strong>
        <span>Coming soon</span>
      </div>
      <span className="reserve-visually-hidden">{product.title}, coming soon</span>
    </article>;
  }

  return <article className="reserve-tea-card">
    <Link to={`/products/${product.handle}`} className="reserve-tea-link" prefetch="intent">
      <div className="reserve-tea-image">{product.featuredImage
        ? <Image data={product.featuredImage} alt={product.featuredImage.altText || product.title} loading="lazy" sizes="(min-width: 900px) 220px, (min-width: 600px) 45vw, 85vw" />
        : <span aria-hidden="true">Charaideo Reserves</span>}</div>
      <span className="reserve-tea-collection">{collectionTitle}</span>
      <h3>{product.title}</h3>
      {product.priceRange && <span className="reserve-tea-price"><Money data={product.priceRange.minVariantPrice} /></span>}
    </Link>
  </article>;
}
