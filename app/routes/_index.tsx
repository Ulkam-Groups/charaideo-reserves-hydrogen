/* eslint-disable @typescript-eslint/ban-ts-comment -- The approved bundle was recovered without its TypeScript source. */
// @ts-nocheck
// Recovered from the supplied approved React artifact. Keep its render tree intact.
import React from 'react';
import {jsx, jsxs} from 'react/jsx-runtime';
import {useNonce} from '@shopify/hydrogen';
import {Link, useLoaderData, useRevalidator} from 'react-router';
import logoUrl from '~/assets/charaideo_logo_transparent.png';
import artifactStylesheet from '~/assets/homepage-artifact.css?url';
import brandStoryStylesheet from '~/styles/brand-story.css?url';
import type {Route} from './+types/_index';
import {findChapterCollection, selectStockedChapterProduct} from '~/lib/chapter-inventory';

export const meta: Route.MetaFunction = () => [
  {title: "Charaideo Reserves | The Reserve List of Assam's Fine Tea Estates"},
  {name: 'description', content: 'One estate, one harvest, fully traceable, no blends.'},
];

export const links = () => [
  {rel: 'stylesheet', href: artifactStylesheet},
  {rel: 'stylesheet', href: brandStoryStylesheet},
];

type ChapterProduct = {
  title: string;
  handle: string;
  variants: {nodes: {availableForSale: boolean; currentlyNotInStock: boolean}[]};
  estate?: {value: string} | null;
  flush?: {value: string} | null;
  grade?: {value: string} | null;
  pluckDate?: {value: string} | null;
  leaf?: {value: string} | null;
};
type ChapterCollection = {title: string; handle: string; products: {nodes: ChapterProduct[]}};

export async function loader({context}: Route.LoaderArgs) {
  let chapterProduct: ChapterProduct | null = null;
  let chapterTwoProduct: ChapterProduct | null = null;
  let chapterThreeProduct: ChapterProduct | null = null;
  let chapterHandle: string | null = null;
  let chapterTwoHandle: string | null = null;
  let chapterThreeHandle: string | null = null;
  try {
    const result = await context.storefront.query(CHAPTER_COLLECTIONS_QUERY, {
      cache: context.storefront.CacheNone(),
    }) as {collections: {nodes: {title: string; handle: string}[]}};
    const titles = ['Chapter I', 'Chapter II', 'Chapter III'];
    const summaries = titles.map((title) => findChapterCollection(result.collections.nodes, title));
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
    [chapterHandle, chapterTwoHandle, chapterThreeHandle] = collections.map((collection) => collection?.handle ?? null);
    chapterProduct = selectStockedChapterProduct(collections[0]?.products.nodes ?? []);
    chapterTwoProduct = selectStockedChapterProduct(collections[1]?.products.nodes ?? []);
    chapterThreeProduct = selectStockedChapterProduct(collections[2]?.products.nodes ?? []);
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
    {chapterProduct, chapterTwoProduct, chapterThreeProduct, chapterHandle, chapterTwoHandle, chapterThreeHandle},
    {headers: {'Cache-Control': 'no-store'}},
  );
}

const CHAPTER_COLLECTIONS_QUERY = `#graphql
  query ChapterCollectionList {
    collections(first: 50) { nodes { title handle } }
  }
` as const;

const CHAPTER_COLLECTION_QUERY = `#graphql
  query ChapterCollectionInventory($handle: String!) {
    collection(handle: $handle) {
      title
      handle
      products(first: 100) {
        nodes {
          title
          handle
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

function BrandStory() {
  return (
    <section className="home-brand-story" aria-labelledby="home-brand-story-title">
      <div className="home-brand-story-inner">
        <div className="home-brand-art">
          <div className="home-brand-plate">
            <div className="home-brand-symbols" aria-hidden="true">
              <svg className="home-brand-cha" viewBox="100 104 130 150" fill="none">
                <path
                  d="M71.92 87.248 C90.44 80.432 100.648 70.424 100.648 52.768 C100.648 26.8 76.808 -0.2 49.809 -0.2 C31.721 -0.2 21.081 10.208 21.081 26.401 L21.081 122.992 L-4.256 122.992 L-4.256 136.624 L115.976 136.624 L115.976 122.992 L35.744 122.992 L35.744 117.24 C35.744 105.137 43.192 98.088 54.464 93.832 L71.92 87.248 Z M35.312 89.576 C35.744 87.68 36.376 76.176 36.376 56.193 L36.376 26.8 C36.376 19.152 40.432 14.032 50.008 14.032 C64.705 14.032 84.921 32.552 84.921 53.001 C84.921 61.28 81.296 68.096 66.6 73.416 L52.768 78.537 C43.425 81.928 38.504 86.816 36.176 89.576 L35.312 89.576 Z"
                  transform="translate(109.14 247.2) scale(1 -1)"
                  fill="#5C171C"
                />
              </svg>
              <span className="home-brand-cup"><i /></span>
            </div>
          </div>
          <div className="home-brand-caption"><span>The river thread / 01</span><span>Charaideo, Assam</span></div>
        </div>
        <div className="home-brand-copy">
          <span className="home-brand-eyebrow">About the mark</span>
          <h2 id="home-brand-story-title">A name drawn<br />from the land.</h2>
          <p>Our Assamese চ meets a cup of Assam tea. The river thread carries a place, its people, and its harvest into every reserve.</p>
          <Link to="/pages/about-us">Discover our story <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  );
}

export default function Homepage() {
  const nonce = useNonce();
  const {chapterProduct, chapterTwoProduct, chapterThreeProduct, chapterHandle, chapterTwoHandle, chapterThreeHandle} = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const isRevealed = Boolean(chapterProduct);
  const estateName = chapterProduct?.estate?.value || chapterProduct?.title || 'Chota Tingrai';
  const chapterHref = chapterProduct && chapterHandle ? `/collections/${chapterHandle}` : '#chapter-collection';

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
      q("You're on the list — first 100 pouches reserved for early access");
    },
    Z = async (a) => {
      a.preventDefault();
      if (!t || !t.includes("@")) {
        q("Please enter a valid email");
        return;
      }
      if (!(await submitWaitlist(t))) return;
      q("You're on the list — first 100 pouches reserved for early access");
      r("");
    };
  return y("div", {
    className:
      "revamp-home min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#FFFEF8] text-[#132A1F] antialiased selection:bg-[#D8CAB3]/40",
    children: [
      f("style", {
        nonce,
        children: `
        .revamp-home * { font-family: "General Sans", system-ui, -apple-system, sans-serif; }
        html, body { max-width: 100vw; overflow-x: hidden; }
        .revamp-home h1,.revamp-home h2,.revamp-home h3,.revamp-home .serif { font-family: "Fraunces", Georgia, serif; font-weight: 500; letter-spacing: -0.02em; }
        .blur-mystery {
          filter: blur(12px);
          background: #D8CAB3;
          padding: 6px 14px;
          border-radius: 8px;
          letter-spacing: 3px;
          user-select: none;
          display: inline-block;
          line-height: 1;
          color: #132A1F;
        }
        .grain:after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          max-width: none;
          animation: marquee 30s linear infinite;
          will-change: transform;
        }
        .marquee-viewport {
          overflow: hidden;
          max-width: 100vw;
          width: 100%;
        }
        @keyframes toastIn {
          0% { transform: translate(-50%, 12px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `,
      }),
      f("div", {
        className:
          "w-full max-w-[100vw] overflow-hidden bg-[#132A1F] text-[#FFFEF8] text-center py-[10px] text-[12px] tracking-[0.14em] uppercase font-[500]",
        children: isRevealed ? "Chapter I — Now Open — First 100 pouches only" : "Chapter I — Opening Soon — First 100 pouches only",
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
                      "Single-estate, single-harvest teas — sourced directly from historic gardens in Assam and reserved in order, Chapter by Chapter. Once a garden enters our list, it stays.",
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
              y("div", {
                className:
                  "order-1 md:order-2 relative flex items-center justify-center max-w-full overflow-hidden",
                children: [
                  f("div", {
                    className:
                      "absolute w-[92%] md:w-[100%] aspect-[1/1.05] md:aspect-[1/0.95] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                    style: {
                      background: "#E7EDE0",
                      borderRadius: "58% 42% 38% 62% / 42% 58% 62% 48%",
                      filter: "blur(0px)",
                    },
                  }),
                  f("div", {
                    className:
                      "absolute w-[78%] max-w-[360px] aspect-square top-1/2 left-1/2 -translate-x-[48%] -translate-y-[52%]",
                    style: {
                      background: "#E7EDE0",
                      opacity: 0.6,
                      borderRadius: "62% 38% 52% 48% / 48% 62% 38% 52%",
                    },
                  }),
                  y("div", {
                    className: "relative z-10 w-[300px] md:w-[380px] max-w-[90vw] select-none",
                    children: [
                      f("div", {
                        className:
                          "absolute -bottom-6 left-1/2 -translate-x-1/2 w-[70%] h-[28px] rounded-[100%] blur-[12px]",
                        style: { background: "rgba(19,42,31,0.12)" },
                      }),
                      y("div", {
                        className:
                          "relative bg-[#FFFEF8]/90 backdrop-blur-[2px] border border-white/80 rounded-[18px] md:rounded-[22px] p-[14px] shadow-[0_18px_60px_rgba(19,42,31,0.12),0_2px_10px_rgba(19,42,31,0.06)]",
                        style: { transform: "rotate(-1.2deg)" },
                        children: [
                          y("div", {
                            className:
                              "bg-white rounded-[12px] md:rounded-[16px] border border-[#132A1F]/[0.04] overflow-hidden",
                            children: [
                              f("div", {
                                className: "px-6 pt-7 pb-2 text-center",
                                children: f("div", {
                                  className:
                                    "text-[10px] tracking-[0.22em] uppercase text-[#5A6B62] font-[600]",
                                  children: "— Chapter I —",
                                }),
                              }),
                              y("div", {
                                className:
                                  "mx-4 mt-2 h-[190px] md:h-[220px] rounded-[10px] bg-[#F5F1E6] relative overflow-hidden border border-[#132A1F]/[0.06] flex items-center justify-center",
                                children: [
                                  y("div", {
                                    className: "absolute inset-0 opacity-[0.85]",
                                    children: [
                                      f("div", {
                                        className: "w-full h-full",
                                        style: {
                                          background:
                                            "radial-gradient(120% 80% at 30% 30%, #8CA88B 0%, #6B8E6A 18%, #4A6B4A 38%, #2F4A2E 68%)",
                                        },
                                      }),
                                      y("svg", {
                                        viewBox: "0 0 200 160",
                                        className: "absolute inset-0 w-full h-full opacity-30",
                                        children: [
                                          f("path", {
                                            d: "M40 80 Q70 20 110 80 T180 80",
                                            stroke: "#132A1F",
                                            strokeWidth: "0.6",
                                            fill: "none",
                                            opacity: "0.2",
                                          }),
                                          f("ellipse", {
                                            cx: "88",
                                            cy: "72",
                                            rx: "26",
                                            ry: "10",
                                            fill: "#132A1F",
                                            opacity: "0.12",
                                            transform: "rotate(-22 88 72)",
                                          }),
                                          f("ellipse", {
                                            cx: "122",
                                            cy: "92",
                                            rx: "22",
                                            ry: "9",
                                            fill: "#132A1F",
                                            opacity: "0.1",
                                            transform: "rotate(18 122 92)",
                                          }),
                                          f("ellipse", {
                                            cx: "102",
                                            cy: "102",
                                            rx: "18",
                                            ry: "7",
                                            fill: "#132A1F",
                                            opacity: "0.12",
                                            transform: "rotate(-8 102 102)",
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                  y("div", {
                                    className: "relative z-10 flex flex-col items-center",
                                    children: [
                                      f("span", {
                                        className: `${isRevealed ? '' : 'blur-mystery'} text-[15px] md:text-[16px]`,
                                        children: estateName,
                                      }),
                                      f("div", {
                                        className:
                                          "mt-3 text-[9px] tracking-[0.18em] uppercase text-[#132A1F]/40",
                                        children: "Whole Leaf • Single Estate",
                                      }),
                                    ],
                                  }),
                                  f("div", {
                                    className:
                                      "absolute inset-0 rounded-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9),inset_0_12px_30px_rgba(255,255,255,0.6)] pointer-events-none",
                                  }),
                                ],
                              }),
                              y("div", {
                                className: "px-6 py-5 text-center",
                                children: [
                                  y("div", {
                                    className:
                                      "text-[11px] tracking-[0.14em] uppercase text-[#132A1F]/60 font-[500]",
                                    children: [
                                      f("span", { className: "block", children: isRevealed ? "Now Open" : "Opening Soon" }),
                                      f("span", {
                                        className: "block mt-[2px]",
                                        children: "First 100 pouches",
                                      }),
                                    ],
                                  }),
                                  f("div", {
                                    className: "mt-3 flex justify-center",
                                    children: f("div", { className: "h-[1px] w-12 bg-[#132A1F]/20" }),
                                  }),
                                  f("div", {
                                    className:
                                      "mt-3 text-[10px] tracking-[0.12em] uppercase text-[#5A6B62]/80",
                                    children: "Charaideo Reserves",
                                  }),
                                ],
                              }),
                            ],
                          }),
                          f("div", {
                            className:
                              "absolute top-[18px] right-[6px] bottom-[18px] w-[10px] bg-gradient-to-l from-black/[0.04] to-transparent rounded-r-[12px] pointer-events-none",
                          }),
                        ],
                      }),
                      f("div", {
                        className:
                          "absolute -right-2 md:-right-6 top-[18%] bg-[#132A1F] text-[#FFFEF8] text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 rounded-full rotate-[8deg] shadow-[0_6px_18px_rgba(0,0,0,0.18)]",
                        children: "Reserve No. 001",
                      }),
                    ],
                  }),
                ],
              }),
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
      <BrandStory />,
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
                  children: "LIBRARY • 3 CHAPTERS • PERMANENT",
                }),
              ],
            }),
            f("div", {
              className:
                "md:hidden mb-6 inline-flex h-[28px] px-4 rounded-full border border-[#132A1F]/20 text-[10px] tracking-[0.18em] uppercase font-[600] items-center text-[#132A1F]/70",
              children: "LIBRARY • 3 CHAPTERS • PERMANENT",
            }),
            y("div", {
              className: "grid grid-cols-1 md:grid-cols-3 gap-6",
              children: [
                y("div", {
                  role: isRevealed ? "link" : "button",
                  tabIndex: 0,
                  "aria-label": isRevealed ? "Explore Chapter I collection" : "Join Waitlist — Chapter I",
                  onClick: (event) => {
                    if (isRevealed) window.location.assign(chapterHref);
                    else d(event);
                  },
                  onKeyDown: (event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (isRevealed) window.location.assign(chapterHref);
                      else d(event);
                    }
                  },
                  className:
                    "rounded-[24px] bg-[#FFFEF8] border border-[#E7EDE0] p-[16px] shadow-[0_8px_32px_rgba(19,42,31,0.04)] flex flex-col cursor-pointer",
                  children: [
                    y("div", {
                      className:
                        "relative h-[280px] rounded-[20px] bg-[#F9F1E6] overflow-hidden flex items-center justify-center",
                      children: [
                        f("div", {
                          className:
                            "absolute w-[72%] aspect-[1.1/0.9] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                          style: {
                            background: "#E7EDE0",
                            borderRadius: "58% 42% 38% 62% / 42% 58% 62% 48%",
                            opacity: 0.95,
                          },
                        }),
                        f("div", {
                          className: "absolute top-4 left-4 z-10",
                          children: f("span", {
                            className:
                              "inline-flex h-[24px] px-3 rounded-full bg-[#D8CAB3] text-[10px] tracking-[0.14em] uppercase font-[600] items-center text-[#132A1F]",
                            children: isRevealed ? "CHAPTER I — OPEN" : "CHAPTER I — SEALED",
                          }),
                        }),
                        y("div", {
                          className: "relative z-10 w-[62%] max-w-[200px] select-none",
                          children: [
                            f("div", {
                              className:
                                "relative bg-white/95 backdrop-blur-[1px] border border-white rounded-[14px] p-[10px] shadow-[0_10px_30px_rgba(19,42,31,0.10),0_1px_6px_rgba(19,42,31,0.06)]",
                              style: { transform: "rotate(-1deg)" },
                              children: y("div", {
                                className:
                                  "bg-white rounded-[10px] border border-[#132A1F]/[0.04] overflow-hidden",
                                children: [
                                  f("div", {
                                    className: "px-3 pt-3 pb-1 text-center",
                                    children: f("div", {
                                      className:
                                        "text-[8px] tracking-[0.20em] uppercase text-[#5A6B62] font-[600]",
                                      children: "— Chapter I —",
                                    }),
                                  }),
                                  y("div", {
                                    className:
                                      "mx-2 mt-1 h-[108px] rounded-[8px] bg-[#F5F1E6] relative overflow-hidden border border-[#132A1F]/[0.06] flex items-center justify-center",
                                    children: [
                                      f("div", {
                                        className: "absolute inset-0 opacity-[0.9]",
                                        style: {
                                          background:
                                            "radial-gradient(120% 80% at 30% 30%, #8CA88B 0%, #6B8E6A 18%, #4A6B4A 38%, #2F4A2E 68%)",
                                        },
                                      }),
                                      y("svg", {
                                        viewBox: "0 0 200 120",
                                        className: "absolute inset-0 w-full h-full opacity-25",
                                        children: [
                                          f("ellipse", {
                                            cx: "88",
                                            cy: "58",
                                            rx: "22",
                                            ry: "9",
                                            fill: "#132A1F",
                                            opacity: "0.12",
                                            transform: "rotate(-22 88 58)",
                                          }),
                                          f("ellipse", {
                                            cx: "118",
                                            cy: "72",
                                            rx: "18",
                                            ry: "7",
                                            fill: "#132A1F",
                                            opacity: "0.1",
                                            transform: "rotate(18 118 72)",
                                          }),
                                        ],
                                      }),
                                      y("div", {
                                        className: "relative z-10 flex flex-col items-center gap-1.5",
                                        children: [
                                          f("span", {
                                            className: `${isRevealed ? '' : 'blur-mystery'} text-[12px]`,
                                            children: estateName,
                                          }),
                                          f("div", {
                                            className:
                                              "text-[7px] tracking-[0.16em] uppercase text-[#132A1F]/40",
                                            children: "Whole Leaf",
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                  f("div", {
                                    className: "px-3 py-3 text-center",
                                    children: y("div", {
                                      className:
                                        "text-[8.5px] tracking-[0.12em] uppercase text-[#132A1F]/60 leading-[1.3] font-[500]",
                                      children: [
                                        f("span", { className: "block", children: isRevealed ? "Now Open" : "Opening Soon" }),
                                        f("span", {
                                          className: "block mt-[1px] opacity-80",
                                          children: "First 100 pouches",
                                        }),
                                      ],
                                    }),
                                  }),
                                ],
                              }),
                            }),
                            f("div", {
                              className:
                                "absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-[14px] rounded-[100%] blur-[8px] bg-[rgba(19,42,31,0.12)]",
                            }),
                          ],
                        }),
                      ],
                    }),
                    y("div", {
                      className: "pt-5 px-1 pb-1 flex flex-col flex-1",
                      children: [
                        f("h3", { className: "serif text-[18px] leading-tight", children: "Chapter I" }),
                        f("p", {
                          className: "mt-1.5 text-[12.5px] leading-[1.5] text-[#5A6B62]",
                          children: isRevealed ? "First 100 pouches • Now Open" : "First 100 pouches • Opening Soon",
                        }),
                        f("div", {
                          className: "mt-4 flex-1 flex items-end",
                          children: f("span", {
                            className:
                              "w-full h-[42px] rounded-full border border-[#132A1F] text-[12px] tracking-[0.06em] uppercase font-[500] inline-flex items-center justify-center hover:bg-[#132A1F] hover:text-white transition",
                            children: isRevealed ? "Explore Chapter I →" : "Join Waitlist — Chapter I →",
                          }),
                        }),
                      ],
                    }),
                  ],
                }),
                y("div", {
                  className:
                    "rounded-[24px] bg-[#FFFEF8] border border-[#E7EDE0] p-[16px] shadow-[0_8px_32px_rgba(19,42,31,0.04)] flex flex-col",
                  children: [
                    y("div", {
                      className:
                        "relative h-[280px] rounded-[20px] bg-[#F9F1E6] overflow-hidden flex items-center justify-center border border-dashed border-[#132A1F]/15",
                      children: [
                        f("div", {
                          className:
                            "absolute w-[68%] aspect-square top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60",
                          style: { background: "#E7EDE0", borderRadius: "62% 38% 52% 48% / 48% 62% 38% 52%" },
                        }),
                        y("div", {
                          className: "relative z-10 flex flex-col items-center gap-2 text-center",
                          children: [
                            f("div", {
                              className: "text-[10px] tracking-[0.20em] uppercase text-[#5A6B62] font-[600]",
                              children: "Chapter II",
                            }),
                            f("div", {
                              className: "serif text-[22px] text-[#132A1F]/70",
                              children: chapterTwoProduct?.estate?.value || chapterTwoProduct?.title || "Coming Soon",
                            }),
                            f("div", { className: "w-8 h-[1px] bg-[#132A1F]/15 mt-1" }),
                          ],
                        }),
                      ],
                    }),
                    y("div", {
                      className: "pt-5 px-1 pb-1 flex flex-col flex-1",
                      children: [
                        f("h3", {
                          className: "serif text-[18px] leading-tight text-[#132A1F]/60",
                          children: "Chapter II",
                        }),
                        f("p", {
                          className: "mt-1.5 text-[12.5px] leading-[1.5] text-[#5A6B62]/70",
                          children: chapterTwoProduct ? "Now Open" : "Coming Soon • Locked",
                        }),
                        f("p", {
                          className: "mt-1 text-[11px] text-[#5A6B62]/60",
                          children: chapterTwoProduct ? "Chapter II reserve available" : "Locked until Chapter I closes",
                        }),
                        f("div", {
                          className: "mt-4 flex-1 flex items-end",
                          children: f(chapterTwoProduct ? "a" : "button", {
                            href: chapterTwoProduct && chapterTwoHandle ? `/collections/${chapterTwoHandle}` : undefined,
                            disabled: !chapterTwoProduct,
                            className: `w-full h-[42px] rounded-full border text-[11px] tracking-[0.06em] uppercase font-[500] inline-flex items-center justify-center ${chapterTwoProduct ? 'border-[#132A1F] text-[#132A1F]' : 'bg-[#F5F1E6] border-[#E7EDE0] text-[#5A6B62]/60 cursor-not-allowed'}`,
                            children: chapterTwoProduct ? "Explore Chapter II →" : "Locked until Chapter I closes",
                          }),
                        }),
                      ],
                    }),
                  ],
                }),
                y("div", {
                  className:
                    "rounded-[24px] bg-[#FFFEF8] border border-[#E7EDE0] p-[16px] shadow-[0_8px_32px_rgba(19,42,31,0.04)] flex flex-col",
                  children: [
                    y("div", {
                      className:
                        "relative h-[280px] rounded-[20px] bg-[#F9F1E6] overflow-hidden flex items-center justify-center border border-dashed border-[#132A1F]/15",
                      children: [
                        f("div", {
                          className:
                            "absolute w-[68%] aspect-square top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60",
                          style: { background: "#E7EDE0", borderRadius: "52% 48% 38% 62% / 62% 42% 58% 48%" },
                        }),
                        y("div", {
                          className: "relative z-10 flex flex-col items-center gap-2 text-center",
                          children: [
                            f("div", {
                              className: "text-[10px] tracking-[0.20em] uppercase text-[#5A6B62] font-[600]",
                              children: "Chapter III",
                            }),
                            f("div", {
                              className: "serif text-[22px] text-[#132A1F]/70",
                              children: chapterThreeProduct?.estate?.value || chapterThreeProduct?.title || "Coming Soon",
                            }),
                            f("div", { className: "w-8 h-[1px] bg-[#132A1F]/15 mt-1" }),
                          ],
                        }),
                      ],
                    }),
                    y("div", {
                      className: "pt-5 px-1 pb-1 flex flex-col flex-1",
                      children: [
                        f("h3", {
                          className: "serif text-[18px] leading-tight text-[#132A1F]/60",
                          children: "Chapter III",
                        }),
                        f("p", {
                          className: "mt-1.5 text-[12.5px] leading-[1.5] text-[#5A6B62]/70",
                          children: chapterThreeProduct ? "Now Open" : "Coming Soon • Locked",
                        }),
                        f("p", {
                          className: "mt-1 text-[11px] text-[#5A6B62]/60",
                          children: chapterThreeProduct ? "Chapter III reserve available" : "Locked until Chapter II closes",
                        }),
                        f("div", {
                          className: "mt-4 flex-1 flex items-end",
                          children: f(chapterThreeProduct ? "a" : "button", {
                            href: chapterThreeProduct && chapterThreeHandle ? `/collections/${chapterThreeHandle}` : undefined,
                            disabled: !chapterThreeProduct,
                            className: `w-full h-[42px] rounded-full border text-[11px] tracking-[0.06em] uppercase font-[500] inline-flex items-center justify-center ${chapterThreeProduct ? 'border-[#132A1F] text-[#132A1F]' : 'bg-[#F5F1E6] border-[#E7EDE0] text-[#5A6B62]/60 cursor-not-allowed'}`,
                            children: chapterThreeProduct ? "Explore Chapter III →" : "Locked until Chapter II closes",
                          }),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
      f("section", {
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
                children: "Chapter I",
              }),
              y("h2", {
                className: "serif mt-4 text-[36px] md:text-[52px] leading-[0.95]",
                children: [
                  f("span", { className: "block", children: isRevealed ? "Now Open" : "Opening Soon" }),
                  f("span", { className: "block", children: "First 100 pouches" }),
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
                children:
                  "We begin where Assam's tea story began — with a garden whose leaves carry the weight of history. The first reserve is whole leaf, single-harvest, sealed in small batches for those who join early.",
              }),
              f("div", {
                className: "mt-8 flex flex-wrap justify-center gap-2",
                children: ["Single-estate", "Whole Leaf", "First 100 pouches"].map((a) =>
                  f(
                    "span",
                    {
                      className:
                        "px-4 py-1.5 rounded-full bg-[#F5F1E6] border border-[#E7EDE0] text-[11px] tracking-[0.08em] uppercase",
                      children: a,
                    },
                    a,
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
                    children: isRevealed ? "Explore Chapter I" : "Reserve My Access for Chapter I",
                  }),
                  f("div", {
                    className: "mt-3 text-[11px] text-[#5A6B62]",
                    children: "No payment today. Invitation when Chapter opens.",
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
          className: "mx-auto max-w-[1280px] px-6 md:px-8 grid md:grid-cols-2 gap-12 md:gap-20 items-start",
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
                    "Every tea we reserve is traceable to the garden it came from. Not a region, not a blend — a single estate, a single pluck, a single story. When you hold a pouch of Charaideo, you hold the place itself. The soil, the season, the hands that picked it.",
                }),
                f("p", {
                  className: "mt-4 text-[15px] leading-[1.8] text-[#132A1F]/70 max-w-[460px]",
                  children:
                    "That is why we list estates in order. Once a garden enters our Reserve List, it stays — Chapter after Chapter — so you can follow a place through time.",
                }),
              ],
            }),
            y("div", {
              className: "rounded-[24px] border border-[#E7EDE0] bg-[#F5F1E6]/60 p-6 md:p-8",
              children: [
                f("div", {
                  className: "text-[11px] tracking-[0.18em] uppercase text-[#5A6B62] font-[600] mb-6",
                  children: "Traceability — Chapter I",
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
                  d: "A clear table, a quiet cup. The tea will do the rest — if you let it.",
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
                children: "Be there when Chapter I opens.",
              }),
              f("p", {
                className: "mt-4 text-[14px] tracking-[0.06em] text-[#FFFEF8]/60",
                children: "First 100 pouches only. Small batch. One garden.",
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
                children: "Invitation only for Chapter I. No spam, unsubscribe anytime.",
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
                        "Reserve Access • First 100 Only",
                      ],
                    }),
                    f("h3", {
                      id: "waitlist-title",
                      className: "serif text-[28px] md:text-[32px] leading-[0.95] tracking-[-0.02em]",
                      children: "Join Waitlist — Chapter I",
                    }),
                    y("div", {
                      className:
                        "mt-4 flex flex-wrap items-center gap-2 text-[13px] leading-[1.6] text-[#5A6B62]",
                      children: [
                        f("span", { children: "First 100 pouches • Opening Soon — Estate:" }),
                        f("span", { className: `${isRevealed ? '' : 'blur-mystery'} text-[13px]`, children: estateName }),
                      ],
                    }),
                    f("p", {
                      className: "mt-3 text-[13.5px] leading-[1.6] text-[#5A6B62]/90",
                      children:
                        "Single-estate, whole leaf. No blends. Invitation when Chapter opens — no payment today.",
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
                      children: "Email for Chapter I access",
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
                          children: "Reserve My Access for Chapter I",
                        }),
                      ],
                    }),
                    f("div", {
                      className: "mt-4 text-center text-[11px] leading-[1.5] text-[#5A6B62]/70",
                      children:
                        "By joining, you agree to receive Chapter I opening invitation. No spam, unsubscribe anytime. First 100 pouches only.",
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
