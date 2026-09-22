import {useState} from 'react';
import {data, Link, useLoaderData} from 'react-router';
import type {Route} from './+types/reserve-list';
import {chapterState, hasInventory, partitionReserveCollections, type ReserveCollection} from '~/lib/reserve-list';
import reserveListStylesheet from '~/assets/reserve-list.css?url';

export const links = () => [{rel: 'stylesheet', href: reserveListStylesheet}];

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
      nodes: {title: string; handle: string; variants: {nodes: {quantityAvailable: number | null}[]}}[];
      pageInfo: {hasNextPage: boolean; endCursor: string | null};
    };
  } | null;
};

export const meta: Route.MetaFunction = () => [
  {title: 'The Reserve List | Charaideo Reserves™'},
  {name: 'description', content: 'Explore the chapters and collections of Charaideo Reserves™.'},
];

export async function loader({context}: Route.LoaderArgs) {
  const summaries: CollectionSummary[] = [];
  let cursor: string | null = null;
  do {
    const result: CollectionsPage = await context.storefront.query(COLLECTIONS_QUERY, {
      variables: {after: cursor},
      cache: context.storefront.CacheNone(),
    });
    summaries.push(...result.collections.nodes);
    cursor = result.collections.pageInfo.hasNextPage ? result.collections.pageInfo.endCursor : null;
  } while (cursor);

  const collections: ReserveCollection[] = [];
  for (const summary of summaries) {
    const products: ReserveCollection['products'] = [];
    let productCursor: string | null = null;
    do {
      const result: ProductPage = await context.storefront.query(COLLECTION_PRODUCTS_QUERY, {
        variables: {handle: summary.handle, after: productCursor},
        cache: context.storefront.CacheNone(),
      });
      if (!result.collection) break;
      products.push(...result.collection.products.nodes);
      productCursor = result.collection.products.pageInfo.hasNextPage
        ? result.collection.products.pageInfo.endCursor
        : null;
    } while (productCursor);
    collections.push({...summary, products});
  }

  return data(partitionReserveCollections(collections), {
    headers: {'Cache-Control': 'no-store'},
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
          variants(first: 250) { nodes { quantityAvailable } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
` as const;

export default function ReserveList() {
  const {chapters, others} = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<'chapters' | 'collections'>('chapters');

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
          <div className="reserve-chapter-list">
            {chapters.map((chapter, index) => {
              const state = chapterState(chapter);
              const label = chapter.title;
              const previous = chapters[index - 1]?.title ?? 'the previous chapter';
              return (
                <div className={`reserve-chapter-row reserve-chapter-row-${state}`} key={chapter.handle}>
                  <div className="reserve-chapter-badge" aria-hidden="true">{label.replace(/^chapter\s+/i, '')}</div>
                  <div className="reserve-chapter-content">
                    <h2>{label}{state === 'open' ? '- Now Open' : '- Coming Soon'}{state !== 'open' && <span className="reserve-lock" aria-label="Locked"> 🔒</span>}</h2>
                    <p>{state === 'locked' ? `Locked until ${previous} closes` : state === 'coming-soon' ? '• First 100 pouches • Once launched, estate name revealed' : `${chapter.products.filter(hasInventory).length} ${chapter.products.filter(hasInventory).length === 1 ? 'product' : 'products'} available`}</p>
                    {state !== 'locked' && <div className="reserve-product-links">
                      {chapter.products.filter((product) => state === 'coming-soon' || hasInventory(product)).map((product, productIndex) => <Link key={product.handle} to={`/products/${product.handle}`}>{state === 'open' ? product.title : `View product ${productIndex + 1}`} <span aria-hidden="true">↗</span></Link>)}
                    </div>}
                  </div>
                  {state === 'locked' ? <span className="reserve-locked-label">Locked</span> : <Link className="reserve-view" to={`/collections/${chapter.handle}`}>→ View</Link>}
                </div>
              );
            })}
            {!chapters.length && <p className="reserve-empty">No chapters are listed yet.</p>}
          </div>
        </section>
        <section id="reserve-collections-panel" role="tabpanel" aria-labelledby="reserve-collections-tab" hidden={tab !== 'collections'}>
          <div className="reserve-collection-grid">
            {others.map((collection) => <Link className="reserve-collection-card" to={`/collections/${collection.handle}`} key={collection.handle}>
              <div className="reserve-collection-top"><span className="reserve-collection-tag">Collection</span><span>{collection.products.length} {collection.products.length === 1 ? 'pouch' : 'pouches'}</span></div>
              <h2>{collection.title}</h2>
              {collection.description && <p>{collection.description}</p>}
              <span className="reserve-collection-view">View collection →</span>
            </Link>)}
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
