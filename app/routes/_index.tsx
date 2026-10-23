/* eslint-disable @typescript-eslint/ban-ts-comment -- The approved bundle was recovered without its TypeScript source. */
// @ts-nocheck
// Recovered from the supplied approved React artifact. Keep its render tree intact.
import React from 'react';
import {jsx, jsxs} from 'react/jsx-runtime';
import {Image, Money} from '@shopify/hydrogen';
import {Link, useLoaderData, useNavigate, useRevalidator, useSearchParams} from 'react-router';
import heroImage from '~/assets/Misty Sunrise Tea Harvest.webp?url';
import artifactStylesheet from '~/assets/homepage-artifact.css?url';
import brandStoryStylesheet from '~/styles/brand-story.css?url';
import type {Route} from './+types/_index';
import {selectStockedChapterProduct} from '~/lib/chapter-inventory';
import {AddToCartButton} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';
import {WishlistButton} from '~/components/WishlistButton';
import {reserveVariantLabel} from '~/lib/reserve-list';

export const meta: Route.MetaFunction = () => [
  {title: "Charaideo Reserves™ | The Reserve List of Assam's Finest Tea Estates"},
  {
    name: 'description',
    content:
      'Discover teas sourced directly from historic gardens in Assam, reserved in order-chapter by chapter.',
  },
];

export const links = () => [
  {rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&display=swap'},
  {rel: 'stylesheet', href: artifactStylesheet},
  {rel: 'stylesheet', href: brandStoryStylesheet},
];

export const headers: Route.HeadersFunction = ({loaderHeaders}) => loaderHeaders;

type ChapterProduct = {
  id: string;
  title: string;
  handle: string;
  availableForSale: boolean;
  featuredImage: {url: string; altText: string | null; width: number; height: number} | null;
  priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
  variants: {nodes: {
    id: string;
    title: string;
    availableForSale: boolean;
    currentlyNotInStock: boolean;
    price: {amount: string; currencyCode: string};
    selectedOptions: {name: string; value: string}[];
  }[]};
  estate?: {value: string} | null;
  flush?: {value: string} | null;
  grade?: {value: string} | null;
  pluckDate?: {value: string} | null;
  leaf?: {value: string} | null;
};
type ChapterCollection = {
  title: string;
  handle: string;
  description: string;
  image: {url: string; altText: string | null; width: number; height: number} | null;
  chapterImages: {references: {nodes: Array<{id: string; image: {url: string; altText: string | null; width: number; height: number} | null}>}} | null;
  chapterVideos: {references: {nodes: Array<{id: string; previewImage?: {url: string; altText: string | null; width: number; height: number} | null; sources?: Array<{url: string; mimeType: string}>; url?: string; mimeType?: string}>}} | null;
  products: {nodes: ChapterProduct[]};
};

const ROMAN_CHAPTER_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

function chapterSequence(title: string): number | null {
  const match = /^chapter\s+([IVXLCDM]+|\d+)$/i.exec(title.trim());
  if (!match) return null;
  if (/^\d+$/.test(match[1])) return Number(match[1]);
  const roman = match[1].toUpperCase();
  return [...roman].reduce((total, character, index) => {
    const value = ROMAN_CHAPTER_VALUES[character];
    const next = ROMAN_CHAPTER_VALUES[roman[index + 1]] ?? 0;
    return total + (value < next ? -value : value);
  }, 0);
}

export async function loader({context}: Route.LoaderArgs) {
  let chapterProduct: ChapterProduct | null = null;
  let chapterCollections: ChapterCollection[] = [];
  const cache = context.storefront.CacheShort({
    maxAge: 60,
    staleWhileRevalidate: 300,
  });
  try {
    const result = await context.storefront.query(CHAPTER_COLLECTIONS_QUERY, {
      cache,
      displayName: 'Homepage chapter collections',
    }) as {collections: {nodes: {title: string; handle: string}[]}};
    const summaries = result.collections.nodes
      .filter((collection) => chapterSequence(collection.title) !== null)
      .sort((a, b) => chapterSequence(a.title)! - chapterSequence(b.title)!)
      .slice(0, 3);
    const collections = await Promise.all(summaries.map(async (summary) => {
      if (!summary) return null;
      try {
        const response = await context.storefront.query(CHAPTER_COLLECTION_QUERY, {
          variables: {handle: summary.handle},
          cache,
          displayName: `Homepage chapter: ${summary.handle}`,
        }) as {collection: ChapterCollection | null};
        return response.collection;
      } catch {
        return null;
      }
    }));
    chapterCollections = collections.filter((collection): collection is ChapterCollection => collection !== null);
    chapterProduct = selectStockedChapterProduct(
      chapterCollections[0]?.products.nodes ?? [],
    );
  } catch {
    // A failed inventory check keeps the mystery state instead of revealing it.
  }

  return Response.json(
    {chapterProduct, chapterCollections},
    {
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}

const CHAPTER_COLLECTIONS_QUERY = `#graphql
  query ChapterCollectionList {
    collections(first: 50, sortKey: TITLE) { nodes { title handle } }
  }
` as const;

const CHAPTER_COLLECTION_QUERY = `#graphql
  query ChapterCollectionInventory($handle: String!) {
    collection(handle: $handle) {
      title
      handle
      description
      image { url altText width height }
      chapterImages: metafield(namespace: "custom", key: "chapter_images") {
        references(first: 20) {
          nodes {
            ... on MediaImage { id image { url altText width height } }
          }
        }
      }
      chapterVideos: metafield(namespace: "custom", key: "chapter_videos") {
        references(first: 20) {
          nodes {
            ... on Video {
              id
              previewImage { url altText width height }
              sources { url mimeType }
            }
            ... on GenericFile {
              id
              url
              mimeType
            }
          }
        }
      }
      products(first: 100) {
        nodes {
          id
          title
          handle
          availableForSale
          featuredImage { url altText width height }
          priceRange { minVariantPrice { amount currencyCode } }
          estate: metafield(namespace: "custom", key: "estate") { value }
          flush: metafield(namespace: "custom", key: "flush") { value }
          grade: metafield(namespace: "custom", key: "grade") { value }
          pluckDate: metafield(namespace: "custom", key: "pluck_date") { value }
          leaf: metafield(namespace: "custom", key: "leaf") { value }
          variants(first: 50) {
            nodes {
              id
              title
              availableForSale
              currentlyNotInStock
              price { amount currencyCode }
              selectedOptions { name value }
            }
          }
        }
      }
    }
  }
` as const;

const xe = React;
const f = jsx;
const y = jsxs;

function HeroBrandArtwork() {
  const artworkRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const artwork = artworkRef.current;
    const river = artwork?.querySelector<SVGPathElement>('.hero-brand-river-bed');
    if (!artwork || !river) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const restingPath = river.getAttribute('d') ?? '';
    let lastScrollY = window.scrollY;
    let scrollingUp = false;
    let hasVisited = window.sessionStorage.getItem('charaideo-home-hero-seen') === 'true';
    let waveFrame = 0;

    const updateDirection = () => {
      scrollingUp = window.scrollY < lastScrollY;
      lastScrollY = window.scrollY;
    };
    const playWave = () => {
      if (waveFrame) window.cancelAnimationFrame(waveFrame);
      river.setAttribute('d', restingPath);
      const length = river.getTotalLength();
      const startedAt = performance.now();
      const duration = 3200;
      const samples = 84;
      const baseSamples = Array.from({length: samples + 1}, (_, index) => {
        const position = index / samples;
        const distance = position * length;
        return {
          position,
          point: river.getPointAtLength(distance),
          before: river.getPointAtLength(Math.max(0, distance - 1)),
          after: river.getPointAtLength(Math.min(length, distance + 1)),
        };
      });

      const renderWave = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        const centre = -0.2 + eased * 1.4;
        const points: string[] = [];

        for (let index = 0; index <= samples; index += 1) {
          const {position, point, before, after} = baseSamples[index];
          const tangentX = after.x - before.x;
          const tangentY = after.y - before.y;
          const tangentLength = Math.hypot(tangentX, tangentY) || 1;
          const normalX = -tangentY / tangentLength;
          const normalY = tangentX / tangentLength;
          const delta = position - centre;
          const envelope = Math.exp(-Math.pow(delta / 0.19, 2));
          const displacement = Math.sin(delta * Math.PI * 3.4) * envelope * 4.25;
          const x = point.x + normalX * displacement;
          const y = point.y + normalY * displacement;
          points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
        }

        river.setAttribute('d', points.join(' '));
        if (progress < 1) {
          waveFrame = window.requestAnimationFrame(renderWave);
        } else {
          river.setAttribute('d', restingPath);
          waveFrame = 0;
        }
      };

      waveFrame = window.requestAnimationFrame(renderWave);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        if (hasVisited && (scrollingUp || window.scrollY < 24) && !reducedMotion.matches) {
          playWave();
        }
        hasVisited = true;
        window.sessionStorage.setItem('charaideo-home-hero-seen', 'true');
      },
      {threshold: 0.35},
    );

    window.addEventListener('scroll', updateDirection, {passive: true});
    observer.observe(artwork);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateDirection);
      if (waveFrame) window.cancelAnimationFrame(waveFrame);
      river.setAttribute('d', restingPath);
    };
  }, []);

  return (
    <div ref={artworkRef} className="hero-brand-art order-1 md:order-2" role="img" aria-label="The Assamese Cha beside a cup of Assam tea">
      <svg className="hero-brand-river" viewBox="0 0 600 430" preserveAspectRatio="none" aria-hidden="true">
        <path className="hero-brand-river-bed" pathLength="1" d="M12 285 C95 195 149 327 242 284 S386 157 453 206 S539 322 593 226" />
      </svg>
      <div className="hero-brand-symbols" aria-hidden="true">
        <svg className="hero-brand-cha" viewBox="100 104 130 150" fill="none">
          <path
            d="M106.5 110.5H216.498L223.482 121.849H143.166C142.293 124.468 142.293 127.087 144.912 130.579C150.15 137.563 156.261 141.055 164.118 145.42C172.848 149.785 180.705 152.404 188.562 155.023C195.546 155.896 200.784 159.388 205.149 165.499C207.768 168.991 208.641 174.229 208.641 179.467C208.641 190.816 204.276 203.038 199.038 212.641C192.927 222.244 182.451 231.847 170.229 235.339C163.245 237.958 152.769 236.212 145.785 233.593C136.182 230.101 131.817 224.863 130.071 217.879C129.198 215.26 129.198 213.514 129.198 210.022V122.722L114.357 121.849L106.5 110.5ZM142.293 142.801C145.785 148.039 151.023 154.15 156.261 159.388C164.118 165.499 172.848 169.864 180.705 171.61C184.197 172.483 185.943 172.483 187.689 174.229C188.562 177.721 187.689 182.086 186.816 185.578C185.07 195.181 180.705 203.038 174.594 210.022C169.356 215.26 163.245 219.625 158.88 220.498C154.515 221.371 150.15 219.625 146.658 217.006C144.039 215.26 142.293 213.514 142.293 210.895V142.801Z"
            fill="#5C171C"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        <span className="hero-brand-cup">
          <span className="hero-brand-steam">
            <i />
            <i />
            <i />
          </span>
          <span className="hero-brand-surface-glint" />
          <span className="hero-brand-ripple" />
          <span className="hero-brand-ripple hero-brand-ripple--trail" />
        </span>
      </div>
    </div>
  );
}

function ChapterCollectionCard({
  collection,
  index,
  onWaitlist,
}: {
  collection: ChapterCollection;
  index: number;
  onWaitlist: (collection: ChapterCollection, event?: React.SyntheticEvent) => void;
}) {
  const navigate = useNavigate();
  const products = collection.products.nodes;
  const stockedProduct = selectStockedChapterProduct(products);
  const primaryProduct = stockedProduct ?? products[0] ?? null;
  const variants = products.flatMap((product) => product.variants.nodes);
  const stockedVariants = variants.filter(
    (variant) => variant.availableForSale && !variant.currentlyNotInStock,
  ).length;
  const isOpen = stockedProduct !== null;
  const hasProducts = products.length > 0;
  const canJoinWaitlist = hasProducts && !isOpen;
  const canJoinChapterUpdates = !hasProducts;
  const isInteractive = isOpen || canJoinWaitlist || canJoinChapterUpdates;
  const status = isOpen ? 'Open' : hasProducts ? 'Next release' : 'Upcoming release';
  const inventoryLabel = variants.length
    ? `${stockedVariants} of ${variants.length} ${variants.length === 1 ? 'variant' : 'variants'} in stock`
    : '0 teas available';
  const href = `/collections/${collection.handle}`;
  const activate = (event: React.SyntheticEvent) => {
    if (isOpen) void navigate(href);
    else if (canJoinWaitlist || canJoinChapterUpdates) onWaitlist(collection, event);
  };

  return (
    <article
      className={`chapter-card ${canJoinWaitlist ? 'chapter-card--waitlist' : ''} ${canJoinChapterUpdates ? 'chapter-card--teaser' : ''} rounded-[24px] bg-white border border-[#E7EDE0] p-[16px] shadow-[0_8px_32px_rgba(19,42,31,0.04)] flex flex-col ${isInteractive ? 'cursor-pointer' : ''}`}
      role={isOpen ? 'link' : isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isOpen ? `Explore ${collection.title}` : canJoinWaitlist ? `Join waitlist for ${collection.title}` : `Join the Reserve List for ${collection.title}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(event);
        }
      }}
    >
      <div className={`chapter-card-art relative h-[280px] rounded-[20px] bg-[#F9F1E6] overflow-hidden flex items-center justify-center ${canJoinWaitlist ? 'chapter-card-art--waitlist' : ''}`}>
        {canJoinWaitlist && primaryProduct ? (
          <ChapterWaitlistArtwork
            product={primaryProduct}
            collectionImage={collection.image}
            collectionTitle={collection.title}
          />
        ) : (
          <ChapterMediaCarousel collection={collection} products={products} />
        )}
        <span className={`chapter-card-status absolute top-4 left-4 z-20 inline-flex h-[24px] px-3 rounded-full bg-[#D8CAB3] text-[10px] tracking-[0.14em] uppercase font-[600] items-center text-[#132A1F] ${canJoinWaitlist ? 'chapter-card-status--waitlist' : ''} ${canJoinChapterUpdates ? 'chapter-card-status--teaser' : ''}`}>
          {collection.title} · {status}
        </span>
      </div>
      <div className="pt-5 px-1 pb-1 flex flex-col flex-1">
        <h3 className="serif text-[22px] leading-[1.12]">{collection.title}</h3>
        {canJoinWaitlist ? (
          <p className="chapter-card-description mt-2 text-[14px] leading-[1.45] text-[#5A6B62]">
            {collection.description || 'A rare single-estate tea is being prepared for the Reserve.'}
          </p>
        ) : canJoinChapterUpdates ? (
          <p className="mt-2 text-[14px] leading-[1.45] text-[#5A6B62]">
            The next estate will be revealed here.
          </p>
        ) : (
          <>
            {collection.description && (
              <p className="chapter-card-description mt-2 text-[14px] leading-[1.45] text-[#5A6B62]">
                {collection.description}
              </p>
            )}
            <p className="mt-2 text-[13px] leading-[1.4] text-[#5A6B62]">
              {products.length} {products.length === 1 ? 'tea' : 'teas'} · {inventoryLabel}
            </p>
            {primaryProduct && <p className="mt-1 text-[12px] leading-[1.35] text-[#5A6B62]/70">{primaryProduct.title}</p>}
          </>
        )}
        <div className="mt-4 flex-1 flex items-end">
          <span className={`w-full min-h-[42px] px-4 rounded-full border text-[11px] tracking-[0.06em] uppercase font-[500] inline-flex items-center justify-center text-center transition ${canJoinWaitlist ? 'border-[#132A1F] bg-[#132A1F] text-white hover:bg-black' : isOpen ? 'border-[#132A1F] text-[#132A1F] hover:bg-[#132A1F] hover:text-white' : canJoinChapterUpdates ? 'border-[#5C171C] bg-[#5C171C] text-white hover:bg-[#3F1014]' : 'bg-[#F5F1E6] border-[#E7EDE0] text-[#5A6B62]/60 cursor-not-allowed'}`}>
            {isOpen ? `Explore ${collection.title}` : canJoinWaitlist ? 'Notify me' : canJoinChapterUpdates ? 'Join the Reserve List' : `${collection.title} · Coming soon`}
          </span>
        </div>
      </div>
    </article>
  );
}

type ChapterCarouselItem =
  | {id: string; kind: 'image'; image: {url: string; altText: string | null; width: number; height: number}}
  | {id: string; kind: 'video'; sources: Array<{url: string; mimeType: string}>};

function ChapterMediaCarousel({
  collection,
  products,
}: {
  collection: ChapterCollection;
  products: ChapterProduct[];
}) {
  const imageReferences = collection.chapterImages?.references.nodes ?? [];
  const videoReferences = collection.chapterVideos?.references.nodes ?? [];
  const customImages: ChapterCarouselItem[] = imageReferences
    .filter((item) => item.image)
    .map((item) => ({id: item.id, kind: 'image', image: item.image!}));
  const customVideos: ChapterCarouselItem[] = videoReferences
    .map((item) => {
      const sources = item.sources?.length
        ? [...item.sources].sort((a, b) =>
            a.mimeType === 'video/mp4' ? -1 : b.mimeType === 'video/mp4' ? 1 : 0,
          )
        : item.url && item.mimeType?.startsWith('video/')
          ? [{url: item.url, mimeType: item.mimeType}]
          : [];
      return sources.length
        ? {id: item.id, kind: 'video' as const, sources}
        : null;
    })
    .filter((item): item is Extract<ChapterCarouselItem, {kind: 'video'}> => item !== null);
  const customMedia = [...customImages, ...customVideos];
  const fallbackProductImage = products.find((product) => product.featuredImage)?.featuredImage;
  const fallbackMedia: ChapterCarouselItem[] = collection.image
    ? [{id: `collection-${collection.handle}`, kind: 'image', image: collection.image}]
    : fallbackProductImage
      ? [{id: `product-${collection.handle}`, kind: 'image', image: fallbackProductImage}]
      : [];
  const media = customMedia.length ? customMedia : fallbackMedia;
  const [activeIndex, setActiveIndex] = React.useState(0);
  const pointerStart = React.useRef<number | null>(null);
  const didSwipe = React.useRef(false);
  const videoRefs = React.useRef<Array<HTMLVideoElement | null>>([]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [collection.handle, media.length]);

  const active = media[activeIndex] ?? media[0];

  React.useEffect(() => {
    if (media.length < 2 || !active) return;
    const timer = window.setTimeout(
      () => setActiveIndex((index) => (index + 1) % media.length),
      active.kind === 'video' ? 5000 : 2000,
    );
    return () => window.clearTimeout(timer);
  }, [active?.id, active?.kind, activeIndex, media.length]);

  React.useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex && media[index]?.kind === 'video') {
        video.load();
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [activeIndex, collection.handle, media.length]);

  if (!media.length) return <ChapterComingSoonArtwork collectionTitle={collection.title} />;

  return (
    <div
      className="chapter-media-carousel"
      onPointerDown={(event) => {
        pointerStart.current = event.clientX;
        didSwipe.current = false;
      }}
      onPointerUp={(event) => {
        if (pointerStart.current === null || media.length < 2) return;
        const distance = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(distance) < 28) return;
        didSwipe.current = true;
        setActiveIndex((index) =>
          distance < 0
            ? (index + 1) % media.length
            : (index - 1 + media.length) % media.length,
        );
      }}
      onClick={(event) => {
        if (!didSwipe.current) return;
        event.preventDefault();
        event.stopPropagation();
        didSwipe.current = false;
      }}
    >
      {media.map((item, index) => (
        <div
          key={item.id}
          className={`chapter-media-slide ${index === activeIndex ? 'is-active' : ''}`}
          aria-hidden={index !== activeIndex}
        >
          {item.kind === 'image' ? (
            <Image
              data={item.image}
              alt={item.image.altText || collection.title}
              loading={index === 0 ? 'eager' : 'lazy'}
              sizes="(min-width: 1100px) 390px, (min-width: 768px) 45vw, 92vw"
              className="chapter-media-item"
            />
          ) : (
            <video
              ref={(node) => {
                videoRefs.current[index] = node;
              }}
              className="chapter-media-item"
              src={item.sources[0].url}
              muted
              playsInline
              preload="none"
              onCanPlay={(event) => {
                if (index === activeIndex) {
                  void event.currentTarget.play().catch(() => undefined);
                }
              }}
              onEnded={() =>
                setActiveIndex((current) => (current + 1) % media.length)
              }
            />
          )}
        </div>
      ))}
      {media.length > 1 && (
        <div className="chapter-media-dots" aria-label="Chapter media">
          {media.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={index === activeIndex ? 'is-active' : ''}
              aria-label={`Show media ${index + 1} of ${media.length}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex(index);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterWaitlistArtwork({
  product,
  collectionImage,
  collectionTitle,
}: {
  product: ChapterProduct;
  collectionImage: ChapterCollection['image'];
  collectionTitle: string;
}) {
  const image = collectionImage || product.featuredImage;
  const estate = product.estate?.value || product.title;

  return (
    <div className="waitlist-artwork">
      <div className="waitlist-artwork-copy">
        <span className="waitlist-artwork-chapter">{collectionTitle}</span>
        <span className="waitlist-artwork-rule" />
        <strong>Arriving Soon</strong>
        <span className="waitlist-artwork-estate">{estate}</span>
        <span className="waitlist-artwork-place">Assam, India</span>
        <p>A rare single-estate tea, carefully selected and crafted for the Reserve.</p>
      </div>
      {image && (
        <Image
          data={image}
          alt={image.altText || product.title}
          loading="lazy"
          sizes="(min-width: 768px) 220px, 45vw"
          className="waitlist-artwork-image"
        />
      )}
      <div className="waitlist-progress" aria-label="Reserve preparation progress">
        <span className="is-active"><i />Sourcing</span>
        <span><i />In curation</span>
        <span><i />Launching this season</span>
      </div>
    </div>
  );
}

function ChapterProductArtwork({
  products,
  collectionImage,
}: {
  products: ChapterProduct[];
  collectionImage: ChapterCollection['image'];
}) {
  if (collectionImage) {
    return (
      <div className="absolute inset-0">
        <Image
          data={collectionImage}
          alt={collectionImage.altText || 'Reserve collection'}
          loading="lazy"
          sizes="(min-width: 768px) 480px, 92vw"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const displayProducts = products.slice(0, 2);

  return (
    <div className="absolute inset-0 flex items-center justify-center pt-5">
      <div
        className="absolute w-[72%] aspect-[1.1/0.9]"
        style={{background: '#E7EDE0', borderRadius: '58% 42% 38% 62% / 42% 58% 62% 48%', opacity: .95}}
      />
      <div className="relative z-10 flex items-center justify-center w-[78%] h-[82%] select-none">
        {displayProducts.map((product, index) => {
          const image = product.featuredImage;
          return (
            <div
              key={product.handle}
              className="absolute w-[48%] max-w-[150px] rounded-[12px] border border-[#132A1F]/10 bg-white p-[7px] shadow-[0_10px_26px_rgba(19,42,31,0.12)]"
              style={{
                transform: `translate(${index === 0 ? '-34%' : '34%'}, ${index === 0 ? '-8%' : '12%'}) rotate(${index === 0 ? '-4deg' : '5deg'})`,
                zIndex: index + 1,
              }}
            >
              <div className="h-[142px] overflow-hidden rounded-[8px] border border-[#132A1F]/[0.06] bg-[#F5F1E6] flex items-center justify-center">
                {image ? (
                  <Image
                    data={image}
                    alt={product.featuredImage?.altText || product.title}
                    loading="lazy"
                    sizes="150px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-3 text-center text-[11px] leading-[1.35] text-[#132A1F]">{product.title}</span>
                )}
              </div>
              <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[#132A1F]">{product.title}</p>
            </div>
          );
        })}
        {products.length > 2 && (
          <span className="absolute right-0 bottom-2 z-20 rounded-full bg-[#132A1F] px-3 py-1.5 text-[9px] font-[600] tracking-[0.08em] text-[#FFFEF8]">
            +{products.length - 2} MORE
          </span>
        )}
      </div>
    </div>
  );
}

function ChapterComingSoonArtwork({collectionTitle}: {collectionTitle: string}) {
  return (
    <>
      <div
        className="absolute w-[68%] aspect-square opacity-60"
        style={{background: '#E7EDE0', borderRadius: '62% 38% 52% 48% / 48% 62% 38% 52%'}}
      />
      <div className="chapter-teaser-copy relative z-10 flex flex-col items-center gap-2 text-center">
        <span className="chapter-teaser-label">{collectionTitle}</span>
        <span className="chapter-teaser-title serif">Something is steeping.</span>
        <span className="chapter-teaser-rule" />
        <span className="chapter-teaser-note">Estate reveal coming soon</span>
      </div>
    </>
  );
}

function HomepageProductCard({product, collectionTitle}: {product: ChapterProduct; collectionTitle: string}) {
  const {open: openAside} = useAside();
  const availableVariants = product.variants.nodes.filter((variant) => variant.availableForSale);
  const [selectedVariantId, setSelectedVariantId] = React.useState(
    availableVariants[0]?.id ?? product.variants.nodes[0]?.id ?? '',
  );
  const selectedVariant = product.variants.nodes.find((variant) => variant.id === selectedVariantId)
    ?? availableVariants[0]
    ?? product.variants.nodes[0];
  const tastingNotes = [product.estate?.value, product.flush?.value, product.grade?.value]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="home-product-card">
      <WishlistButton
        className="wishlist-button--card"
        product={{
          id: product.id,
          handle: product.handle,
          title: product.title,
          image: product.featuredImage
            ? {url: product.featuredImage.url, altText: product.featuredImage.altText}
            : null,
          price: product.priceRange.minVariantPrice,
        }}
      />
      <Link className="home-product-card-link" to={`/products/${product.handle}`} prefetch="none">
        <div className="home-product-card-image">
          {product.featuredImage
            ? <Image data={product.featuredImage} alt={product.featuredImage.altText || product.title} loading="lazy" sizes="(min-width: 900px) 360px, 78vw" />
            : <span>Charaideo Reserves</span>}
        </div>
        <span className="home-product-card-collection">{collectionTitle}</span>
        <h3>{product.title}</h3>
        {tastingNotes && <p>{tastingNotes}</p>}
      </Link>
      <div className="home-product-card-commerce">
        <div className="home-product-card-meta">
          <strong aria-live="polite">
            {selectedVariant?.price ? (
              <Money data={selectedVariant.price} />
            ) : (
              <Money data={product.priceRange.minVariantPrice} />
            )}
          </strong>
          <span>{product.availableForSale ? 'In stock' : 'Unavailable'}</span>
        </div>
        {product.variants.nodes.length > 0 && (
          <fieldset className="home-product-card-variants">
            <legend>Select pack</legend>
            <div>
              {product.variants.nodes.map((variant) => (
                <label key={variant.id} data-selected={selectedVariantId === variant.id} data-available={variant.availableForSale}>
                  <input
                    type="radio"
                    name={`home-card-variant-${product.handle}`}
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
        <div className="home-product-card-actions">
          <AddToCartButton
            disabled={!selectedVariant?.availableForSale}
            lines={selectedVariant ? [{merchandiseId: selectedVariant.id, quantity: 1, selectedVariant}] : []}
            onClick={() => openAside('cart')}
          >
            Add to bag
          </AddToCartButton>
          <Link to={`/products/${product.handle}`} prefetch="none">View tea</Link>
        </div>
      </div>
    </article>
  );
}

function HomepageProductRail({items}: {items: {product: ChapterProduct; collectionTitle: string}[]}) {
  if (!items.length) return null;
  return (
    <section id="home-product-list" className="home-product-list" aria-labelledby="home-product-list-title">
      <header>
        <div>
          <h2 id="home-product-list-title">Explore the tea collection.</h2>
        </div>
        <Link to="/reserve-list" prefetch="intent">View the Reserve List</Link>
      </header>
      <div className="home-product-rail" role="list">
        {items.map(({product, collectionTitle}) => (
          <div role="listitem" key={product.handle}>
            <HomepageProductCard product={product} collectionTitle={collectionTitle} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Homepage() {
  const {chapterCollections} = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const homepageProducts = Array.from(
    chapterCollections.reduce((products, collection) => {
      collection.products.nodes.forEach((product) => {
        if (!products.has(product.handle)) {
          products.set(product.handle, {product, collectionTitle: collection.title});
        }
      });
      return products;
    }, new Map<string, {product: ChapterProduct; collectionTitle: string}>()).values(),
  );

  React.useEffect(() => {
    const checkInventory = () => {
      if (document.visibilityState === 'visible') revalidator.revalidate();
    };
    const interval = window.setInterval(checkInventory, 60_000);
    window.addEventListener('focus', checkInventory);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkInventory);
    };
  }, [revalidator]);

  React.useEffect(() => {
    const divider = document.querySelector<HTMLElement>('.home-section-river');
    if (!divider || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const updateSealPosition = () => {
      frame = 0;
      const rect = divider.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      divider.style.setProperty('--home-seal-shift', `${28 - progress * 56}px`);
    };
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateSealPosition);
    };
    updateSealPosition();
    window.addEventListener('scroll', handleScroll, {passive: true});
    window.addEventListener('resize', handleScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);
  const [waitlistChapter, setWaitlistChapter] = xe.useState<ChapterCollection | null>(null);
  const A = waitlistChapter !== null;
  const waitlistProduct = waitlistChapter?.products.nodes[0] ?? null;
  const waitlistEstateName =
    waitlistProduct?.estate?.value || waitlistProduct?.title || 'Revealed soon';
  let [l, i] = xe.useState(""),
    [submitting, setSubmitting] = xe.useState(!1),
    [o, c] = xe.useState({ visible: !1, message: "" }),
    p = xe.useRef(null),
    z = () => {
      let a = document.getElementById("chapter-collection");
      if (a) a.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    d = (collection: ChapterCollection, event?: React.SyntheticEvent) => {
      if (event) event.preventDefault();
      setWaitlistChapter(collection);
      z();
    },
    E = () => {
      setWaitlistChapter(null);
    };
  xe.useEffect(() => {
    if (A) {
      document.body.style.overflow = "hidden";
      setTimeout(() => p.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [A]);
  xe.useEffect(() => {
    const requestedHandle = searchParams.get('join');
    const requestedChapter = chapterCollections.find(
      (collection) => collection.handle === requestedHandle,
    );
    if (
      !requestedChapter?.products.nodes.length ||
      selectStockedChapterProduct(requestedChapter.products.nodes)
    ) return;

    setWaitlistChapter(requestedChapter);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('join');
    setSearchParams(nextParams, {preventScrollReset: true, replace: true});
  }, [chapterCollections, searchParams, setSearchParams]);
  xe.useEffect(() => {
    let a = (P) => {
      if (P.key === "Escape" && A) E();
    };
    window.addEventListener("keydown", a);
    return () => window.removeEventListener("keydown", a);
  }, [A]);
  let q = (a) => {
      c({ visible: !0, message: a });
      window.setTimeout(() => c({ visible: !1, message: "" }), 3800);
    },
    submitWaitlist = async (email) => {
      if (submitting) return !1;
      setSubmitting(!0);
      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email, consent: true}),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || 'Unable to join the list. Please try again.');
        }
        return !0;
      } catch (error) {
        q(error instanceof Error ? error.message : 'Unable to join the list. Please try again.');
        return !1;
      } finally {
        setSubmitting(!1);
      }
    },
    g = async (a) => {
      a.preventDefault();
      if (!l || !l.includes("@")) {
        q("Please enter a valid email");
        return;
      }
      if (!(await submitWaitlist(l))) return;
      E();
      i("");
      q(`You're on the list for ${waitlistChapter?.title ?? 'the next reserve'}`);
    };
  return y("div", {
    className:
      "revamp-home min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white text-[#132A1F] antialiased selection:bg-[#D8CAB3]/40",
    children: [
      f("section", {
        className: "home-hero-stage relative overflow-hidden max-w-[100vw]",
        children: [
          f("img", {
            className: "home-hero-image",
            src: heroImage,
            alt: "",
            "aria-hidden": true,
          }, "hero-image"),
          f("div", {
          className: "relative z-[2] mx-auto max-w-[1280px] px-6 md:px-8",
          children: y("div", {
            className: "home-hero-layout grid md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-6 items-center",
            children: [
              y("div", {
                className: "hero-copy-reveal order-2 md:order-1",
                children: [
                  y("div", {
                    className:
                      "hero-eyebrow inline-flex items-center gap-2 text-[12px] tracking-[0.16em] uppercase text-[#C4A484] font-[600] mb-6",
                    children: [
                      f("span", { className: "w-6 h-[1px] bg-[#C4A484]" }),
                      "Assam, North-East India",
                    ],
                  }),
                  y("h1", {
                    className:
                      "hero-display-title serif text-[42px] md:text-[64px] leading-[0.93] tracking-[-0.025em] max-w-[560px]",
                    children: [
                      "The Reserve Collections of ",
                      f("span", {
                        className: "hero-title-accent",
                        children: "Assam's",
                      }),
                      " Finest Teas.",
                    ],
                  }),
                  f("p", {
                    className:
                      "hero-intro mt-5 text-[16px] md:text-[17px] leading-[1.5] text-[#132A1F]/70 max-w-[500px]",
                    children:
                      "We go to one estate at a time and bring what they do best to you. Straight from the source, released chapter by chapter.",
                  }),
                  y("div", {
                    className: "hero-actions mt-8",
                    children: [
                      f("a", {
                        href: "#chapter-collection",
                        className:
                          "hero-action rounded-full bg-[#132A1F] text-[#FFFEF8] uppercase font-[500] hover:bg-black transition",
                        "data-mobile-label": "Explore the Reserve",
                        children: f("span", {
                          className: "hero-action-label--desktop",
                          children: "Explore the Reserve",
                        }),
                      }),
                      f("a", {
                        href: "/pages/about-us",
                        className:
                          "hero-action rounded-full border border-[#132A1F]/20 text-[#132A1F] uppercase font-[500] hover:border-[#132A1F] transition",
                        "data-mobile-label": "Our Story",
                        children: f("span", {
                          className: "hero-action-label--desktop",
                          children: "Our Story",
                        }),
                      }),
                    ],
                  }),
                  f("div", {
                    className: "hero-proof mt-10 pt-6 border-t border-[#132A1F]/[0.08] max-w-[480px]",
                    children: f("p", {
                      className: "text-[12px] tracking-[0.12em] uppercase text-[#5A6B62] font-[600]",
                      children: "Grown in Assam, reserved as it is.",
                    }),
                  }),
                ],
              }),
              <HeroBrandArtwork />,
            ],
          }),
          }, "hero-content"),
        ],
      }),
      f("div", {
        className:
          "home-marquee-strip w-full max-w-[100vw] bg-[#132A1F] overflow-hidden marquee-viewport",
        children: f("div", {
          className: "home-marquee-inner relative w-full max-w-[100vw] overflow-hidden",
          children: y("div", {
            className: "marquee-track",
            children: [
              y("div", {
                className: "flex items-center gap-8 pr-8 shrink-0",
                children: [
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                ],
              }),
              y("div", {
                className: "flex items-center gap-8 pr-8 shrink-0",
                "aria-hidden": "true",
                children: [
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                  y("span", {
                    className:
                      "flex items-center gap-8 text-[12px] tracking-[0.22em] uppercase text-[#FFFEF8] font-[500]",
                    children: [
                      f("span", { children: "Curated from Origin" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Reserved with Purpose" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                      f("span", { children: "Shared with the World" }),
                      f("span", { className: "w-1 h-1 rounded-full bg-[#FFFEF8]/60" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        }),
      }),
      f("section", {
        id: "chapter-collection",
        className: "chapter-collection-stage scroll-mt-[96px] max-w-[100vw] overflow-hidden",
        children: y("div", {
          className: "chapter-collection-inner mx-auto max-w-[1280px] px-6 md:px-8",
          children: [
            y("div", {
              className: "flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10",
              children: [
                y("div", {
                  children: [
                    f("div", {
                      className: "text-[11px] tracking-[0.18em] uppercase text-[#C4A484] font-[600] mb-3",
                      children: "Our Reserves",
                    }),
                    f("h2", {
                      className: "chapter-collection-heading serif",
                      children: "The Reserve, chapter by chapter.",
                    }),
                    f("p", {
                      className: "mt-3 text-[15px] leading-[1.5] text-[#5A6B62] max-w-[460px]",
                      children: "Discover each garden as it enters the list.",
                    }),
                  ],
                }),
              ],
            }),
            f("div", {
              className:
                "md:hidden mb-6 inline-flex h-[28px] px-4 rounded-full border border-[#132A1F]/20 text-[10px] tracking-[0.18em] uppercase font-[600] items-center text-[#132A1F]/70",
              children: `LIBRARY • ${chapterCollections.length} CHAPTERS • PERMANENT`,
            }),
            f("div", {
              className: "chapter-card-track",
              children: chapterCollections.map((collection, index) =>
                f(
                  ChapterCollectionCard,
                  {collection, index, onWaitlist: d},
                  collection.handle,
                ),
              ),
            }),
          ],
        }),
      }),
      y("div", {
        className: "home-section-river home-section-river--mirrored",
        "aria-hidden": "true",
        children: [
          f("svg", {
            className: "home-river-seal-mark",
            viewBox: "100 104 130 150",
            fill: "none",
            focusable: "false",
            children: f("path", {
              d: "M106.5 110.5H216.498L223.482 121.849H143.166C142.293 124.468 142.293 127.087 144.912 130.579C150.15 137.563 156.261 141.055 164.118 145.42C172.848 149.785 180.705 152.404 188.562 155.023C195.546 155.896 200.784 159.388 205.149 165.499C207.768 168.991 208.641 174.229 208.641 179.467C208.641 190.816 204.276 203.038 199.038 212.641C192.927 222.244 182.451 231.847 170.229 235.339C163.245 237.958 152.769 236.212 145.785 233.593C136.182 230.101 131.817 224.863 130.071 217.879C129.198 215.26 129.198 213.514 129.198 210.022V122.722L114.357 121.849L106.5 110.5ZM142.293 142.801C145.785 148.039 151.023 154.15 156.261 159.388C164.118 165.499 172.848 169.864 180.705 171.61C184.197 172.483 185.943 172.483 187.689 174.229C188.562 177.721 187.689 182.086 186.816 185.578C185.07 195.181 180.705 203.038 174.594 210.022C169.356 215.26 163.245 219.625 158.88 220.498C154.515 221.371 150.15 219.625 146.658 217.006C144.039 215.26 142.293 213.514 142.293 210.895V142.801Z",
              fill: "currentColor",
              fillRule: "evenodd",
              clipRule: "evenodd",
            }),
          }),
          f("span", {className: "home-river-seal-place", children: "ASSAM"}),
          y("span", {className: "home-river-seal-coordinate", children: ["26.98", f("sup", {children: "\u00b0"})]}),
        ],
      }),
      f(HomepageProductRail, {items: homepageProducts}),
      y("section", {
        className: "heritage-note",
        children: [
          f("span", {
            className: "eyebrow",
            children: "Where it all began",
          }),
          y("div", {
            children: [
              y("h2", {
                children: [
                  "There’s so much more to Tea.",
                  f("br", {})
                ],
              }),
              y("div", {
                children: [
                  f("p", {
                    children: "Tea has a world of its own, and most of us have only scratched the surface.",
                  }),
                  f("p", {
                    children: "From delicate white teas to distinctive green teas and carefully crafted black teas, the same tea plant can offer so many different experiences. We want to bring these teas closer to you, starting with the gardens of Assam.",
                  }),
                  f("p", {children: "Come, discover tea beyond the familiar."}),
                ],
              }),
              f(Link, {
                to: "/reserve-list",
                prefetch: "intent",
                className: "text-link",
                children: "Explore our collection \u2197",
              }),
            ],
          }),
          y("span", {
            className: "heritage-seal",
            "aria-hidden": "true",
            children: [
              f("svg", {
                className: "heritage-seal-mark",
                viewBox: "100 104 130 150",
                fill: "none",
                focusable: "false",
                children: f("path", {
                  d: "M106.5 110.5H216.498L223.482 121.849H143.166C142.293 124.468 142.293 127.087 144.912 130.579C150.15 137.563 156.261 141.055 164.118 145.42C172.848 149.785 180.705 152.404 188.562 155.023C195.546 155.896 200.784 159.388 205.149 165.499C207.768 168.991 208.641 174.229 208.641 179.467C208.641 190.816 204.276 203.038 199.038 212.641C192.927 222.244 182.451 231.847 170.229 235.339C163.245 237.958 152.769 236.212 145.785 233.593C136.182 230.101 131.817 224.863 130.071 217.879C129.198 215.26 129.198 213.514 129.198 210.022V122.722L114.357 121.849L106.5 110.5ZM142.293 142.801C145.785 148.039 151.023 154.15 156.261 159.388C164.118 165.499 172.848 169.864 180.705 171.61C184.197 172.483 185.943 172.483 187.689 174.229C188.562 177.721 187.689 182.086 186.816 185.578C185.07 195.181 180.705 203.038 174.594 210.022C169.356 215.26 163.245 219.625 158.88 220.498C154.515 221.371 150.15 219.625 146.658 217.006C144.039 215.26 142.293 213.514 142.293 210.895V142.801Z",
                  fill: "currentColor",
                  fillRule: "evenodd",
                  clipRule: "evenodd",
                }),
              }),
              f("span", {className: "heritage-seal-place", children: "ASSAM"}),
              y("span", {
                className: "heritage-seal-coordinate",
                children: ["26.98", f("sup", {children: "\u00b0"})],
              }),
            ],
          }),
        ],
      }),
      f("section", {
        className:
          "home-ritual-section bg-white border-t border-[#132A1F]/[0.06] max-w-[100vw] overflow-hidden",
        children: y("div", {
          className: "mx-auto max-w-[1280px] px-6 md:px-8",
          children: [
            y("div", {
              className: "max-w-[760px]",
              children: [
                f("div", {
                  className: "text-[11px] tracking-[0.18em] uppercase text-[#C4A484] font-[600] mb-4",
                  children: "The art of taking a moment",
                }),
                f("h2", {
                  className: "serif text-[36px] md:text-[48px] leading-[0.98]",
                  children: "Nothing to hurry. Something to savour.",
                }),
              ],
            }),
            f("div", {
              className: "mt-14 grid md:grid-cols-3 gap-10 md:gap-12 border-t border-[#132A1F]/[0.06] pt-10",
              children: [
                {
                  n: "01",
                  t: "Choose with care",
                  d: "A bold morning black or a light afternoon green. Begin with the cup you want.",
                },
                {
                  n: "02",
                  t: "Give it time",
                  d: "Fresh water, your favourite cup and a little patience. Follow the included brew guide.",
                },
                {
                  n: "03",
                  t: "Make room",
                  d: "For one more cup. For conversation. For a quiet pause in the day.",
                },
              ].map((a) =>
                y(
                  "div",
                  {
                    children: [
                      f("div", {
                        className: "text-[12px] tracking-[0.14em] uppercase text-[#C4A484] font-[600] mb-3",
                        children: a.n,
                      }),
                      f("h3", { className: "serif text-[22px] leading-[1.15]", children: a.t }),
                      f("p", { className: "mt-2 text-[14px] leading-[1.5] text-[#5A6B62]", children: a.d }),
                    ],
                  },
                  a.n,
                ),
              ),
            }),
          ],
        }),
      }),
      A &&
        y("div", {
          className: "fixed inset-0 z-[100] flex items-center justify-center p-4",
          children: [
            f("button", {
              "aria-label": "Close waitlist modal",
              onClick: E,
              className: "absolute inset-0 bg-[#132A1F]/40 backdrop-blur-[6px]",
            }),
            y("div", {
              role: "dialog",
              "aria-modal": "true",
              "aria-labelledby": "waitlist-title",
              className:
                "relative w-full max-w-[520px] bg-white rounded-[24px] border border-[#132A1F]/[0.08] shadow-[0_24px_80px_rgba(19,42,31,0.18),0_4px_16px_rgba(19,42,31,0.08)] p-7 md:p-10",
              children: [
                f("button", {
                  onClick: E,
                  "aria-label": "Close",
                  className:
                    "absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F5F1E6] border border-[#E7EDE0] flex items-center justify-center text-[#132A1F] hover:bg-[#132A1F] hover:text-white transition",
                  children: f("span", { className: "text-[16px] leading-none", children: "✕" }),
                }),
                y("div", {
                  className: "pr-8",
                  children: [
                    y("div", {
                      className:
                        "inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-[#C4A484] font-[600] mb-4",
                      children: [
                        f("span", { className: "w-5 h-[1px] bg-[#C4A484]" }),
                        `Reserve Access • ${waitlistChapter?.products.nodes.length ?? 0} ${(waitlistChapter?.products.nodes.length ?? 0) === 1 ? 'Tea' : 'Teas'}`,
                      ],
                    }),
                    f("h3", {
                      id: "waitlist-title",
                      className: "serif text-[28px] md:text-[32px] leading-[0.95] tracking-[-0.02em]",
                      children: `Join Waitlist- ${waitlistChapter?.title}`,
                    }),
                    y("div", {
                      className:
                        "mt-4 flex flex-wrap items-center gap-2 text-[13px] leading-[1.6] text-[#5A6B62]",
                      children: [
                        f("span", { children: `${waitlistProduct?.title ?? 'Reserve'} • Opening Soon- Estate:` }),
                        f("span", { className: "text-[13px]", children: waitlistEstateName }),
                      ],
                    }),
                    f("p", {
                      className: "mt-3 text-[13.5px] leading-[1.6] text-[#5A6B62]/90",
                      children:
                        "Receive an invitation when this Chapter opens. No payment today.",
                    }),
                  ],
                }),
                y("form", {
                  onSubmit: g,
                  className: "mt-8",
                  children: [
                    f("label", {
                      htmlFor: "waitlist-email",
                      className:
                        "block text-[11px] tracking-[0.14em] uppercase font-[600] text-[#5A6B62] mb-2.5",
                      children: `Email for ${waitlistChapter?.title} access`,
                    }),
                    y("div", {
                      className: "flex flex-col gap-3",
                      children: [
                        f("input", {
                          id: "waitlist-email",
                          ref: p,
                          type: "email",
                          required: !0,
                          name: "contact[email]",
                          value: l,
                          onChange: (a) => i(a.target.value),
                          placeholder: "your@email.com",
                          className:
                            "w-full h-[48px] rounded-full bg-white border border-[#132A1F]/15 px-6 text-[15px] placeholder:text-[#132A1F]/40 outline-none focus:border-[#132A1F] focus:ring-2 focus:ring-[#132A1F]/10 transition",
                          autoComplete: "email",
                        }),
                        f("button", {
                          type: "submit",
                          disabled: submitting,
                          className:
                            "w-full h-[52px] rounded-full bg-[#132A1F] text-[#FFFEF8] text-[13.5px] tracking-[0.06em] uppercase font-[600] inline-flex items-center justify-center hover:bg-black transition",
                          children: `Reserve My Access for ${waitlistChapter?.title}`,
                        }),
                      ],
                    }),
                    f("div", {
                      className: "mt-4 text-center text-[11px] leading-[1.5] text-[#5A6B62]/70",
                      children:
                        `By joining, you agree to receive the ${waitlistChapter?.title ?? 'reserve'} opening invitation. No spam, unsubscribe anytime.`,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      o.visible &&
        f("div", {
          role: "status",
          "aria-live": "polite",
          className: "fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 max-w-[90vw] md:max-w-[520px] w-auto",
          style: { animation: "toastIn 0.32s ease-out" },
          children: y("div", {
            className:
              "bg-[#132A1F] text-[#FFFEF8] rounded-full px-6 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.24)] flex items-center gap-3 text-[13px] leading-[1.4]",
            children: [
              f("span", {
                className:
                  "w-6 h-6 rounded-full bg-[#FFFEF8]/15 flex items-center justify-center text-[12px]",
                children: "✓",
              }),
              f("span", { className: "font-[500] tracking-[0.01em]", children: o.message }),
            ],
          }),
        }),
    ],
  });
}
