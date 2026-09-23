/* eslint-disable @typescript-eslint/ban-ts-comment -- The approved bundle was recovered without its TypeScript source. */
// @ts-nocheck
// Recovered from the supplied approved React artifact. Keep its render tree intact.
import React from 'react';
import {jsx, jsxs} from 'react/jsx-runtime';
import {Image} from '@shopify/hydrogen';
import {useLoaderData, useRevalidator} from 'react-router';
import artifactStylesheet from '~/assets/homepage-artifact.css?url';
import brandStoryStylesheet from '~/styles/brand-story.css?url';
import type {Route} from './+types/_index';

export const meta: Route.MetaFunction = () => [
  {title: "Charaideo Reserves™ | The Reserve List of Assam's Fine Tea Estates"},
  {name: 'description', content: 'One estate, one harvest, fully traceable, no blends.'},
];

export const links = () => [
  {rel: 'stylesheet', href: artifactStylesheet},
  {rel: 'stylesheet', href: brandStoryStylesheet},
];

type ChapterProduct = {
  title: string;
  handle: string;
  availableForSale: boolean;
  featuredImage: {url: string; altText: string | null; width: number; height: number} | null;
  variants: {nodes: {availableForSale: boolean; currentlyNotInStock: boolean}[]};
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
  try {
    const result = await context.storefront.query(CHAPTER_COLLECTIONS_QUERY, {
      cache: context.storefront.CacheNone(),
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
          cache: context.storefront.CacheNone(),
        }) as {collection: ChapterCollection | null};
        return response.collection;
      } catch {
        return null;
      }
    }));
    chapterCollections = collections.filter((collection): collection is ChapterCollection => collection !== null);
    chapterProduct = chapterCollections[0]?.products.nodes.find((product) => product.availableForSale) ?? null;
    if (chapterProduct) {
      try {
        const detail = await context.storefront.query(CHAPTER_PRODUCT_DETAILS_QUERY, {
          variables: {handle: chapterProduct.handle},
          cache: context.storefront.CacheNone(),
        }) as {product: Partial<ChapterProduct> | null};
        chapterProduct = {...chapterProduct, ...detail.product};
      } catch {
        // The collection still opens when optional metafields are unavailable.
      }
    }
  } catch {
    // A failed inventory check keeps the mystery state instead of revealing it.
  }

  return Response.json(
    {chapterProduct, chapterCollections},
    {headers: {'Cache-Control': 'no-store'}},
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
      products(first: 100) {
        nodes {
          title
          handle
          availableForSale
          featuredImage { url altText width height }
          estate: metafield(namespace: "custom", key: "estate") { value }
          variants(first: 50) {
            nodes { availableForSale currentlyNotInStock }
          }
        }
      }
    }
  }
` as const;

const CHAPTER_PRODUCT_DETAILS_QUERY = `#graphql
  query ChapterProductDetails($handle: String!) {
    product(handle: $handle) {
      estate: metafield(namespace: "custom", key: "estate") { value }
      flush: metafield(namespace: "custom", key: "flush") { value }
      grade: metafield(namespace: "custom", key: "grade") { value }
      pluckDate: metafield(namespace: "custom", key: "pluck_date") { value }
      leaf: metafield(namespace: "custom", key: "leaf") { value }
    }
  }
` as const;

const xe = React;
const f = jsx;
const y = jsxs;

function HeroBrandArtwork() {
  return (
    <div className="hero-brand-art order-1 md:order-2" role="img" aria-label="The Assamese Cha beside a cup of Assam tea">
      <svg className="hero-brand-river" viewBox="0 0 600 430" preserveAspectRatio="none" aria-hidden="true">
        <path d="M12 285 C95 195 149 327 242 284 S386 157 453 206 S539 322 593 226" />
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
          <i />
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
  onWaitlist: (event?: React.SyntheticEvent) => void;
}) {
  const products = collection.products.nodes;
  const availableProducts = products.filter((product) => product.availableForSale);
  const primaryProduct = availableProducts[0] ?? products[0] ?? null;
  const variants = products.flatMap((product) => product.variants.nodes);
  const stockedVariants = variants.filter(
    (variant) => variant.availableForSale && !variant.currentlyNotInStock,
  ).length;
  const isOpen = availableProducts.length > 0;
  const hasProducts = products.length > 0;
  const canJoinWaitlist = index === 0 && hasProducts && !isOpen;
  const status = isOpen ? 'Open' : hasProducts ? 'Coming soon' : 'Locked';
  const inventoryLabel = variants.length
    ? `${stockedVariants} of ${variants.length} ${variants.length === 1 ? 'variant' : 'variants'} in stock`
    : `${availableProducts.length} ${availableProducts.length === 1 ? 'tea' : 'teas'} available`;
  const href = `/collections/${collection.handle}`;
  const activate = (event: React.SyntheticEvent) => {
    if (isOpen) window.location.assign(href);
    else if (canJoinWaitlist) onWaitlist(event);
  };

  return (
    <article
      className={`rounded-[24px] bg-[#FFFEF8] border border-[#E7EDE0] p-[16px] shadow-[0_8px_32px_rgba(19,42,31,0.04)] flex flex-col ${isOpen || canJoinWaitlist ? 'cursor-pointer' : ''}`}
      role={isOpen ? 'link' : canJoinWaitlist ? 'button' : undefined}
      tabIndex={isOpen || canJoinWaitlist ? 0 : undefined}
      aria-label={isOpen ? `Explore ${collection.title}` : canJoinWaitlist ? `Join waitlist for ${collection.title}` : `${collection.title}, ${status}`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(event);
        }
      }}
    >
      <div className="relative h-[280px] rounded-[20px] bg-[#F9F1E6] overflow-hidden flex items-center justify-center">
        {products.length ? (
          <ChapterProductArtwork
            products={products}
            collectionImage={collection.image}
          />
        ) : (
          <ChapterComingSoonArtwork collectionTitle={collection.title} />
        )}
        <span className="absolute top-4 left-4 z-20 inline-flex h-[24px] px-3 rounded-full bg-[#D8CAB3] text-[10px] tracking-[0.14em] uppercase font-[600] items-center text-[#132A1F]">
          {collection.title} · {status}
        </span>
      </div>
      <div className="pt-5 px-1 pb-1 flex flex-col flex-1">
        <h3 className="serif text-[18px] leading-tight">{collection.title}</h3>
        {collection.description && <p className="mt-2 text-[12.5px] leading-[1.55] text-[#5A6B62]">{collection.description}</p>}
        <p className="mt-2 text-[12.5px] leading-[1.5] text-[#5A6B62]">
          {products.length} {products.length === 1 ? 'tea' : 'teas'} · {inventoryLabel}
        </p>
        {primaryProduct && <p className="mt-1 text-[11px] text-[#5A6B62]/70">{primaryProduct.title}</p>}
        <div className="mt-4 flex-1 flex items-end">
          <span className={`w-full min-h-[42px] px-4 rounded-full border text-[11px] tracking-[0.06em] uppercase font-[500] inline-flex items-center justify-center text-center transition ${isOpen || canJoinWaitlist ? 'border-[#132A1F] text-[#132A1F] hover:bg-[#132A1F] hover:text-white' : 'bg-[#F5F1E6] border-[#E7EDE0] text-[#5A6B62]/60 cursor-not-allowed'}`}>
            {isOpen ? `Explore ${collection.title} →` : canJoinWaitlist ? `Join waitlist · ${collection.title} →` : hasProducts ? `${collection.title} · Coming soon` : 'No teas listed yet'}
          </span>
        </div>
      </div>
    </article>
  );
}

function ChapterProductArtwork({
  products,
  collectionImage,
}: {
  products: ChapterProduct[];
  collectionImage: ChapterCollection['image'];
}) {
  const displayProducts = products.slice(0, 2);

  return (
    <div className="absolute inset-0 flex items-center justify-center pt-5">
      <div
        className="absolute w-[72%] aspect-[1.1/0.9]"
        style={{background: '#E7EDE0', borderRadius: '58% 42% 38% 62% / 42% 58% 62% 48%', opacity: .95}}
      />
      <div className="relative z-10 flex items-center justify-center w-[78%] h-[82%] select-none">
        {displayProducts.map((product, index) => {
          const image = product.featuredImage || collectionImage;
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
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <span className="text-[10px] tracking-[0.20em] uppercase text-[#5A6B62] font-[600]">{collectionTitle}</span>
        <span className="serif text-[22px] text-[#132A1F]/70">Coming Soon</span>
        <span className="w-8 h-[1px] bg-[#132A1F]/15 mt-1" />
      </div>
    </>
  );
}

export default function Homepage() {
  const {chapterProduct, chapterCollections} = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const firstChapter = chapterCollections[0] ?? null;
  const firstChapterProduct = firstChapter?.products.nodes[0] ?? null;
  const chapterOneHasProducts = Boolean(firstChapter?.products.nodes.length);
  const isRevealed = Boolean(chapterProduct);
  const isChapterOneWaitlist = chapterOneHasProducts && !isRevealed;
  const estateName = chapterProduct?.estate?.value || firstChapterProduct?.estate?.value || firstChapterProduct?.title || 'Revealed soon';
  const chapterHref = chapterProduct && firstChapter ? `/collections/${firstChapter.handle}` : '#chapter-collection';

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
  let [t, r] = xe.useState(""),
    [A, u] = xe.useState(!1),
    [l, i] = xe.useState(""),
    [submitting, setSubmitting] = xe.useState(!1),
    [o, c] = xe.useState({ visible: !1, message: "" }),
    p = xe.useRef(null),
    z = () => {
      let a = document.getElementById("chapter-collection");
      if (a) a.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    d = (a) => {
      if (a) a.preventDefault();
      u(!0);
      z();
    },
    E = () => {
      u(!1);
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
      q(`You're on the list for ${firstChapter?.title ?? 'the next reserve'}`);
    },
    Z = async (a) => {
      a.preventDefault();
      if (!t || !t.includes("@")) {
        q("Please enter a valid email");
        return;
      }
      if (!(await submitWaitlist(t))) return;
      q(`You're on the list for ${firstChapter?.title ?? 'the next reserve'}`);
      r("");
    };
  return y("div", {
    className:
      "revamp-home min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#FFFEF8] text-[#132A1F] antialiased selection:bg-[#D8CAB3]/40",
    children: [
      f("div", {
        className:
          "w-full max-w-[100vw] overflow-hidden bg-[#132A1F] text-[#FFFEF8] text-center py-[10px] text-[12px] tracking-[0.14em] uppercase font-[500]",
        children: isRevealed
          ? `${firstChapter?.title ?? 'Reserve'}- Now Open`
          : isChapterOneWaitlist
            ? `${firstChapter?.title ?? 'Reserve'}- Opening Soon`
            : "The Reserve List- New chapters coming soon",
      }),
      f("section", {
        className: "relative bg-[#FFFEF8] overflow-hidden max-w-[100vw]",
        children: f("div", {
          className: "mx-auto max-w-[1280px] px-6 md:px-8",
          children: y("div", {
            className: "grid md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-6 items-center py-12 md:py-[88px]",
            children: [
              y("div", {
                className: "order-2 md:order-1",
                children: [
                  y("div", {
                    className:
                      "inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-[#C4A484] font-[600] mb-6",
                    children: [
                      f("span", { className: "w-6 h-[1px] bg-[#C4A484]" }),
                      "Assam, North East India",
                    ],
                  }),
                  f("h1", {
                    className:
                      "serif text-[42px] md:text-[64px] leading-[0.95] tracking-[-0.03em] max-w-[560px]",
                    children: "The Reserve List of Assam's Fine Tea Estates.",
                  }),
                  f("p", {
                    className:
                      "mt-6 text-[16px] md:text-[17px] leading-[1.7] text-[#132A1F]/70 max-w-[480px]",
                    children:
                      "Single-estate, single-harvest teas- sourced directly from historic gardens in Assam and reserved in order, Chapter by Chapter. Once a garden enters our list, it stays.",
                  }),
                  y("div", {
                    className: "mt-8 flex flex-wrap gap-3",
                    children: [
                      f("a", {
                        href: "#",
                        className:
                          "h-[48px] px-7 rounded-full bg-[#132A1F] text-[#FFFEF8] text-[13.5px] tracking-[0.04em] uppercase font-[500] inline-flex items-center justify-center hover:bg-black transition",
                        children: "Explore Our Reserves",
                      }),
                      f("a", {
                        href: "#",
                        className:
                          "h-[48px] px-7 rounded-full border border-[#132A1F]/20 text-[#132A1F] text-[13.5px] tracking-[0.04em] uppercase font-[500] inline-flex items-center justify-center hover:border-[#132A1F] transition",
                        children: "The story of Charaideo",
                      }),
                    ],
                  }),
                  f("div", {
                    className: "mt-10 pt-6 border-t border-[#132A1F]/[0.08] max-w-[480px]",
                    children: f("p", {
                      className: "text-[11.5px] tracking-[0.14em] uppercase text-[#5A6B62] font-[500]",
                      children: "One Estate, One Harvest, Fully Traceable, No Blends.",
                    }),
                  }),
                ],
              }),
              <HeroBrandArtwork />,
            ],
          }),
        }),
      }),
      f("div", {
        className:
          "w-full max-w-[100vw] bg-[#132A1F] overflow-hidden border-y border-[#FFFEF8]/[0.08] marquee-viewport",
        children: f("div", {
          className: "relative w-full max-w-[100vw] overflow-hidden py-[14px]",
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
                      f("span", { children: "Rooted in Assam" }),
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
        className: "bg-[#FFFEF8] py-16 md:py-24 scroll-mt-[96px] max-w-[100vw] overflow-hidden",
        children: y("div", {
          className: "mx-auto max-w-[1280px] px-6 md:px-8",
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
                      className: "serif text-[32px] md:text-[44px] leading-[0.95]",
                      children: "The Reserves people return to.",
                    }),
                    f("p", {
                      className: "mt-3 text-[14.5px] text-[#5A6B62] max-w-[420px]",
                      children: "Each pouch is one estate, one harvest, fully traceable. No blends.",
                    }),
                  ],
                }),
                f("div", {
                  className:
                    "hidden md:inline-flex h-[28px] px-4 rounded-full border border-[#132A1F]/20 text-[10px] tracking-[0.18em] uppercase font-[600] items-center text-[#132A1F]/70",
                  children: `LIBRARY • ${chapterCollections.length} CHAPTERS • PERMANENT`,
                }),
              ],
            }),
            f("div", {
              className:
                "md:hidden mb-6 inline-flex h-[28px] px-4 rounded-full border border-[#132A1F]/20 text-[10px] tracking-[0.18em] uppercase font-[600] items-center text-[#132A1F]/70",
              children: `LIBRARY • ${chapterCollections.length} CHAPTERS • PERMANENT`,
            }),
            f("div", {
              className: "grid grid-cols-1 md:grid-cols-3 gap-6",
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
      chapterOneHasProducts && f("section", {
        id: "chapter-1",
        className: "bg-[#F5F1E6] py-12 md:py-20 scroll-mt-[96px] max-w-[100vw] overflow-hidden",
        children: f("div", {
          className: "mx-auto max-w-[1280px] px-6 md:px-8",
          children: y("div", {
            className:
              "bg-[#FFFEF8] rounded-[32px] border border-[#132A1F]/[0.06] p-8 md:p-16 text-center max-w-[900px] mx-auto shadow-[0_8px_32px_rgba(19,42,31,0.04)]",
            children: [
              f("div", {
                className: "text-[11px] tracking-[0.22em] uppercase text-[#C4A484] font-[600]",
                children: firstChapter?.title,
              }),
              y("h2", {
                className: "serif mt-4 text-[36px] md:text-[52px] leading-[0.95]",
                children: [
                  f("span", { className: "block", children: isRevealed ? "Now Open" : "Opening Soon" }),
                  f("span", {
                    className: "block",
                    children: `${firstChapter?.products.nodes.length ?? 0} ${(firstChapter?.products.nodes.length ?? 0) === 1 ? 'tea' : 'teas'}`,
                  }),
                ],
              }),
              y("div", {
                className: "mt-6 flex items-center justify-center gap-3 text-[13px]",
                children: [
                  f("span", { className: "text-[#5A6B62]", children: "Estate" }),
                  f("span", { className: `${isRevealed ? '' : 'blur-mystery'} text-[14px]`, children: estateName }),
                ],
              }),
              f("p", {
                className: "mt-6 text-[15px] leading-[1.7] text-[#5A6B62] max-w-[520px] mx-auto",
                children: firstChapter?.description || `${firstChapterProduct?.title ?? 'This reserve'} is listed in ${firstChapter?.title ?? 'the Reserve List'}.`,
              }),
              f("div", {
                className: "mt-8 flex flex-wrap justify-center gap-2",
                children: (firstChapter?.products.nodes ?? []).slice(0, 3).map((product) =>
                  f(
                    "span",
                    {
                      className:
                        "px-4 py-1.5 rounded-full bg-[#F5F1E6] border border-[#E7EDE0] text-[11px] tracking-[0.08em] uppercase",
                      children: product.title,
                    },
                    product.handle,
                  ),
                ),
              }),
              y("div", {
                className: "mt-10",
                children: [
                  f("a", {
                    href: chapterHref,
                    onClick: isRevealed ? undefined : d,
                    className:
                      "inline-flex h-[48px] px-8 rounded-full bg-[#132A1F] text-white text-[13px] tracking-[0.06em] uppercase font-[500] items-center justify-center hover:bg-black transition",
                    children: isRevealed ? `Explore ${firstChapter?.title}` : `Join waitlist · ${firstChapter?.title}`,
                  }),
                  f("div", {
                    className: "mt-3 text-[11px] text-[#5A6B62]",
                    children: `${firstChapter?.products.nodes.length ?? 0} ${(firstChapter?.products.nodes.length ?? 0) === 1 ? 'tea' : 'teas'} in this collection.`,
                  }),
                ],
              }),
            ],
          }),
        }),
      }),
      f("section", {
        id: "about",
        className: "bg-[#FFFEF8] py-16 md:py-28 max-w-[100vw] overflow-hidden scroll-mt-[96px]",
        children: y("div", {
          className: `mx-auto max-w-[1280px] px-6 md:px-8 grid ${chapterOneHasProducts ? 'md:grid-cols-2' : ''} gap-12 md:gap-20 items-start`,
          children: [
            y("div", {
              children: [
                f("div", {
                  className: "text-[11px] tracking-[0.18em] uppercase text-[#C4A484] font-[600] mb-4",
                  children: "More than a place of origin",
                }),
                f("h2", {
                  className: "serif text-[32px] md:text-[44px] leading-[0.95] max-w-[420px]",
                  children: "We keep the estate name on the pouch.",
                }),
                f("p", {
                  className: "mt-6 text-[15px] leading-[1.8] text-[#132A1F]/70 max-w-[460px]",
                  children:
                    "Every tea we reserve is traceable to the garden it came from. Not a region, not a blend- a single estate, a single pluck, a single story. When you hold a pouch of Charaideo, you hold the place itself. The soil, the season, the hands that picked it.",
                }),
                f("p", {
                  className: "mt-4 text-[15px] leading-[1.8] text-[#132A1F]/70 max-w-[460px]",
                  children:
                    "That is why we list estates in order. Once a garden enters our Reserve List, it stays- Chapter after Chapter- so you can follow a place through time.",
                }),
              ],
            }),
            chapterOneHasProducts && y("div", {
              className: "rounded-[24px] border border-[#E7EDE0] bg-[#F5F1E6]/60 p-6 md:p-8",
              children: [
                f("div", {
                  className: "text-[11px] tracking-[0.18em] uppercase text-[#5A6B62] font-[600] mb-6",
                  children: `Traceability- ${firstChapter?.title}`,
                }),
                f("div", {
                  className: "space-y-4",
                  children: [
                    { label: "Estate", value: estateName },
                    { label: "Flush", value: chapterProduct?.flush?.value || "Revealed soon" },
                    { label: "Grade", value: chapterProduct?.grade?.value || "Revealed soon" },
                    { label: "Pluck Date", value: chapterProduct?.pluckDate?.value || "Revealed soon" },
                    { label: "Leaf", value: chapterProduct?.leaf?.value || "Revealed soon" },
                  ].map((a) =>
                    y(
                      "div",
                      {
                        className:
                          "flex items-center justify-between py-3 border-b border-[#132A1F]/[0.06] last:border-0",
                        children: [
                          f("span", {
                            className: "text-[13px] tracking-[0.04em] uppercase text-[#5A6B62]",
                            children: a.label,
                          }),
                          f("span", { className: `${isRevealed ? '' : 'blur-mystery'} text-[13px]`, children: a.value }),
                        ],
                      },
                      a.label,
                    ),
                  ),
                }),
                f("div", {
                  className: "mt-6 text-[11px] text-[#5A6B62]/70 leading-[1.6]",
                  children:
                    "Full details revealed to Reserve List on opening. Each pouch carries its own trace card.",
                }),
              ],
            }),
          ],
        }),
      }),
      f("section", {
        className:
          "bg-[#FFFEF8] border-t border-[#132A1F]/[0.06] py-16 md:py-24 max-w-[100vw] overflow-hidden",
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
                  className: "serif text-[32px] md:text-[48px] leading-[0.95]",
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
                  d: "Pick a Reserve that speaks to the moment you are in. Light and lifted for mornings, deeper and roasted for slow evenings.",
                },
                {
                  n: "02",
                  t: "Give it time",
                  d: "Measure, heat, steep. Whole leaves need space to unfurl and time to release what the season stored in them.",
                },
                {
                  n: "03",
                  t: "Make room",
                  d: "A clear table, a quiet cup. The tea will do the rest- if you let it.",
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
                      f("h3", { className: "serif text-[20px]", children: a.t }),
                      f("p", { className: "mt-3 text-[14px] leading-[1.7] text-[#5A6B62]", children: a.d }),
                    ],
                  },
                  a.n,
                ),
              ),
            }),
          ],
        }),
      }),
      f("section", {
        id: "contact",
        className:
          "bg-[#132A1F] text-[#FFFEF8] py-16 md:py-24 max-w-[100vw] overflow-hidden scroll-mt-[96px]",
        children: f("div", {
          className: "mx-auto max-w-[1280px] px-6 md:px-8",
          children: y("div", {
            className: "max-w-[720px] mx-auto text-center",
            children: [
              f("h2", {
                className: "serif text-[36px] md:text-[56px] leading-[0.92]",
                children: `Be there when ${firstChapter?.title ?? 'the next reserve'} opens.`,
              }),
              f("p", {
                className: "mt-4 text-[14px] tracking-[0.06em] text-[#FFFEF8]/60",
                children: `${firstChapter?.products.nodes.length ?? 0} ${(firstChapter?.products.nodes.length ?? 0) === 1 ? 'tea' : 'teas'} listed. Small batch. One garden.`,
              }),
              y("form", {
                onSubmit: Z,
                className: "mt-10 flex flex-col sm:flex-row gap-3 max-w-[440px] mx-auto",
                children: [
                  f("input", {
                    value: t,
                    onChange: (a) => r(a.target.value),
                    placeholder: "Your email",
                    type: "email",
                    required: !0,
                    name: "contact[email]",
                    className:
                      "flex-1 h-[48px] rounded-full bg-[#FFFEF8]/[0.08] border border-[#FFFEF8]/20 px-6 text-[14px] placeholder:text-[#FFFEF8]/40 outline-none focus:border-[#FFFEF8]/40",
                  }),
                  f("button", {
                    type: "submit",
                    disabled: submitting,
                    className:
                      "h-[48px] px-7 rounded-full bg-[#FFFEF8] text-[#132A1F] text-[13px] tracking-[0.06em] uppercase font-[600] hover:bg-white transition",
                    children: "Join Reserve List",
                  }),
                ],
              }),
              f("div", {
                className: "mt-4 text-[11px] text-[#FFFEF8]/40",
                children: `Invitation only for ${firstChapter?.title ?? 'the next reserve'}. No spam, unsubscribe anytime.`,
              }),
            ],
          }),
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
                "relative w-full max-w-[520px] bg-[#FFFEF8] rounded-[24px] border border-[#132A1F]/[0.08] shadow-[0_24px_80px_rgba(19,42,31,0.18),0_4px_16px_rgba(19,42,31,0.08)] p-7 md:p-10",
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
                        `Reserve Access • ${firstChapter?.products.nodes.length ?? 0} ${(firstChapter?.products.nodes.length ?? 0) === 1 ? 'Tea' : 'Teas'}`,
                      ],
                    }),
                    f("h3", {
                      id: "waitlist-title",
                      className: "serif text-[28px] md:text-[32px] leading-[0.95] tracking-[-0.02em]",
                      children: `Join Waitlist- ${firstChapter?.title}`,
                    }),
                    y("div", {
                      className:
                        "mt-4 flex flex-wrap items-center gap-2 text-[13px] leading-[1.6] text-[#5A6B62]",
                      children: [
                        f("span", { children: `${firstChapterProduct?.title ?? 'Reserve'} • Opening Soon- Estate:` }),
                        f("span", { className: `${isRevealed ? '' : 'blur-mystery'} text-[13px]`, children: estateName }),
                      ],
                    }),
                    f("p", {
                      className: "mt-3 text-[13.5px] leading-[1.6] text-[#5A6B62]/90",
                      children:
                        "Single-estate, whole leaf. No blends. Invitation when Chapter opens- no payment today.",
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
                      children: `Email for ${firstChapter?.title} access`,
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
                          children: `Reserve My Access for ${firstChapter?.title}`,
                        }),
                      ],
                    }),
                    f("div", {
                      className: "mt-4 text-center text-[11px] leading-[1.5] text-[#5A6B62]/70",
                      children:
                        `By joining, you agree to receive the ${firstChapter?.title ?? 'reserve'} opening invitation. No spam, unsubscribe anytime.`,
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
