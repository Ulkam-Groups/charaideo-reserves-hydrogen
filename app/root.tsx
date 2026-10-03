import {Analytics, getShopAnalytics, Script, useNonce} from '@shopify/hydrogen';
import {useEffect, useState} from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import {PageLayout} from '~/components/PageLayout';
import {CheckoutConfirmationProgress} from '~/components/CheckoutConfirmationProgress';
import {HEADER_QUERY} from '~/lib/fragments';
import stylesheet from '~/styles/app.css?url';
import identity from '~/styles/identity.css?url';
import revamp from '~/styles/revamp.css?url';
import reserveListStylesheet from '~/assets/reserve-list.css?url';
import favicon from '~/assets/favicon.svg?url';
import {buildAnalyticsConsent} from '~/lib/analytics';
import {
  measureOptionalStorefront,
  monitoringEnabled,
  sentryIngestOrigin,
} from '~/lib/monitoring.server';
import {resolveCheckoutProvider} from '~/lib/checkout/provider';
import {selectStockedChapterProduct} from '~/lib/chapter-inventory';
import {
  parseStorefrontNotices,
  type StorefrontNoticeMetaobject,
} from '~/lib/storefront-notices';
import {FASTRR_ASSETS} from '~/lib/checkout/providers/fastrr/fastrr.config';
import {RAZORPAY_ASSETS} from '~/lib/checkout/providers/razorpay/razorpay.config';

const SHOPIFY_CHAT_SCRIPT = '/shopify-chat-assets/chat.js?v=top-composer-1';
const SHOPIFY_CHAT_WARMUP_MS = 120;
const SHOPIFY_CHAT_REVEAL_FALLBACK_MS = 7_000;
const SHOPIFY_CHAT_CLOSE_ANIMATION_MS = 380;
const SHOPIFY_CHAT_LAYOUT_PROBE_MS = 250;
const SHOPIFY_CHAT_LAYOUT_PROBE_LIMIT = 80;
const SHOPIFY_CHAT_TOP_PANEL_STYLE_ID = 'charaideo-chat-top-panel';
const SHOPIFY_CHAT_TOP_PANEL_CSS = `
  .backdrop {
    position: fixed !important;
    z-index: 0 !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    pointer-events: auto !important;
    display: none !important;
    opacity: 0 !important;
    transition:
      opacity 300ms ease,
      display 300ms allow-discrete !important;
    transition-behavior: allow-discrete !important;
  }

  :host([open]) .backdrop {
    display: block !important;
    opacity: 1 !important;
    background: rgb(6 17 11 / 62%) !important;
    transition-delay: 0s !important;
  }

  @starting-style {
    :host([open]) .backdrop {
      opacity: 0 !important;
    }
  }

  :host([data-prewarming='true']) .panel,
  :host([data-prewarming='true']) .backdrop {
    transition: none !important;
    animation: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop {
      transition: none !important;
    }
  }
`;
const SHOPIFY_CHAT_TOP_COMPOSER_STYLE_ID = 'charaideo-chat-top-composer';
const SHOPIFY_CHAT_TOP_COMPOSER_CSS = `
  .chat {
    grid-template-rows: auto minmax(0, 1fr) !important;
  }

  .chat > .composer {
    grid-row: 1 !important;
    grid-column: 1 !important;
    align-self: start !important;
    margin-top: var(--private-panel-header-height) !important;
    padding: 0 var(--private-spacing-xl) var(--private-spacing-sm) !important;
  }

  .chat > .scroll-container {
    grid-row: 2 !important;
    grid-column: 1 !important;
    min-height: 0 !important;
  }

  .chat > .scroll-container::before {
    height: var(--private-spacing-sm) !important;
  }

  .chat > .scroll-container::after {
    height: var(--private-spacing-xl) !important;
  }

  .chat > .scroll-feather {
    display: none !important;
  }

  .chat > .jump-to-latest {
    bottom: var(--private-spacing-lg) !important;
  }
`;
const GOOGLE_FONTS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap';
type ChapterAnnouncementResult = {
  collections: {
    nodes: Array<{
      title: string;
      handle: string;
      products: {
        nodes: Array<{
          variants: {
            nodes: Array<{
              availableForSale: boolean;
              currentlyNotInStock: boolean;
            }>;
          };
        }>;
      };
    }>;
  };
  metaobjects: {
    nodes: StorefrontNoticeMetaobject[];
  };
};
export function links() {
  return [
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
    {rel: 'preconnect', href: 'https://cdn.shopify.com', crossOrigin: 'anonymous'},
    {
      rel: 'preconnect',
      href: 'https://storefront-agent-server.shopify.ai',
      crossOrigin: 'anonymous',
    },
    {
      rel: 'preconnect',
      href: 'https://messaging-api.shopifyapps.com',
      crossOrigin: 'anonymous',
    },
    {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous'},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  const {cart, customerAccount, env, storefront} = context;
  const publicStoreDomain = env.PUBLIC_STORE_DOMAIN;
  const configuredChatShop = env.PUBLIC_SHOPIFY_CHAT_SHOP?.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const chatShopDomain = `https://${
    configuredChatShop || 'charaideoreserves.myshopify.com'
  }`;
  const checkoutProvider = resolveCheckoutProvider(env.CHECKOUT_PROVIDER);
  const fastrrSellerDomain =
    checkoutProvider === 'fastrr'
      ? env.PUBLIC_FASTRR_SELLER_DOMAIN?.trim() || null
      : null;
  const razorpayReady =
    checkoutProvider === 'razorpay' &&
    Boolean(
      env.RAZORPAY_KEY_ID?.trim() &&
      env.RAZORPAY_KEY_SECRET?.trim() &&
      env.RAZORPAY_WEBHOOK_SECRET?.trim() &&
      env.SHOPIFY_ADMIN_CLIENT_ID?.trim() &&
      env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim() &&
      /^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(
        (env.SHOPIFY_ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN)?.trim() ?? '',
      ),
    );

  const [header, chapterAnnouncementResult] = await Promise.all([
    measureOptionalStorefront(context.monitor, 'header', () =>
      storefront.query(HEADER_QUERY, {
        variables: {headerMenuHandle: 'main-menu'},
        cache: storefront.CacheLong(),
      }),
    ),
    measureOptionalStorefront(
      context.monitor,
      'global_notices',
      () =>
        storefront.query(GLOBAL_NOTICES_QUERY, {
          cache: storefront.CacheShort({maxAge: 30, staleWhileRevalidate: 60}),
        }) as Promise<ChapterAnnouncementResult>,
    ),
  ]);
  const chapter =
    chapterAnnouncementResult?.collections.nodes.find(
      (collection) => collection.title.trim().toLocaleLowerCase() === 'chapter i',
    ) ?? null;
  const stockedChapterProduct = chapter
    ? selectStockedChapterProduct(chapter.products.nodes)
    : null;
  const chapterAnnouncement = chapter
    ? {
        title: chapter.title,
        handle: chapter.handle,
        state: stockedChapterProduct
          ? ('open' as const)
          : chapter.products.nodes.length
            ? ('opening-soon' as const)
            : ('upcoming' as const),
      }
    : {
        title: 'Chapter I',
        handle: 'chapter-i',
        state: 'opening-soon' as const,
      };
  const chapterNotice = {
    id: 'automatic-chapter-i',
    message:
      chapterAnnouncement.state === 'open'
        ? `${chapterAnnouncement.title} · Open Now`
        : chapterAnnouncement.state === 'opening-soon'
          ? `${chapterAnnouncement.title} · Opening Soon`
          : `${chapterAnnouncement.title} · Coming Soon`,
    buttonLabel:
      chapterAnnouncement.state === 'open'
        ? 'Explore Now →'
        : chapterAnnouncement.state === 'opening-soon'
          ? 'Join Now →'
          : 'View Reserve List →',
    buttonLink:
      chapterAnnouncement.state === 'open'
        ? `/collections/${chapterAnnouncement.handle}`
        : chapterAnnouncement.state === 'opening-soon'
          ? `/?join=${encodeURIComponent(chapterAnnouncement.handle)}#chapter-collection`
          : '/reserve-list',
    displayOrder: 1,
    tone:
      chapterAnnouncement.state === 'open' ? ('success' as const) : ('default' as const),
    state: chapterAnnouncement.state,
  };
  const notices = [
    chapterNotice,
    ...parseStorefrontNotices(chapterAnnouncementResult?.metaobjects.nodes ?? []),
  ].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
  );

  return {
    cart: measureOptionalStorefront(context.monitor, 'cart', () => cart.get()),
    consent: buildAnalyticsConsent(env),
    notices,
    header,
    isLoggedIn: customerAccount.isLoggedIn(),
    publicStoreDomain,
    chatShopDomain,
    checkoutProvider,
    checkoutReady:
      checkoutProvider === 'fastrr' ? Boolean(fastrrSellerDomain) : razorpayReady,
    fastrrSellerDomain,
    sentryDsn:
      monitoringEnabled(env.SENTRY_ENABLED) && sentryIngestOrigin(env.SENTRY_DSN)
        ? env.SENTRY_DSN
        : null,
    sentryEnvironment: env.SENTRY_ENVIRONMENT?.trim() || 'production',
    shop: measureOptionalStorefront(context.monitor, 'shop_analytics', () =>
      getShopAnalytics({
        storefront,
        publicStorefrontId: env.PUBLIC_STOREFRONT_ID || '0',
      }),
    ),
  };
}

const GLOBAL_NOTICES_QUERY = `#graphql
  query GlobalNotices {
    collections(first: 50, sortKey: TITLE) {
      nodes {
        title
        handle
        products(first: 50) {
          nodes {
            variants(first: 50) {
              nodes { availableForSale currentlyNotInStock }
            }
          }
        }
      }
    }
    metaobjects(type: "storefront_notice", first: 50) {
      nodes {
        id
        message: field(key: "message") { value }
        buttonLabel: field(key: "button_label") { value }
        buttonLink: field(key: "button_link") { value }
        enabled: field(key: "enabled") { value }
        displayOrder: field(key: "display_order") { value }
        startsAt: field(key: "start_date_time") { value }
        endsAt: field(key: "end_date_time") { value }
        tone: field(key: "style_tone") { value }
      }
    }
  }
` as const;

export default function App() {
  const data = useLoaderData<typeof loader>();
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {data.sentryDsn && <meta name="sentry-dsn" content={data.sentryDsn} />}
        {data.sentryDsn && (
          <meta name="sentry-environment" content={data.sentryEnvironment} />
        )}
        <Meta />
        <Links />
        <link rel="stylesheet" href={stylesheet} />
        <link rel="stylesheet" href={identity} />
        <link rel="stylesheet" href={revamp} />
        <link rel="stylesheet" href={reserveListStylesheet} />
      </head>
      <body>
        {data.fastrrSellerDomain && (
          <input
            type="hidden"
            id="sellerDomain"
            value={data.fastrrSellerDomain}
            readOnly
          />
        )}
        <Analytics.Provider cart={data.cart} consent={data.consent} shop={data.shop}>
          <PageLayout {...data}>
            <Outlet />
          </PageLayout>
        </Analytics.Provider>
        <CheckoutConfirmationProgress />
        {data.fastrrSellerDomain && (
          <Script waitForHydration src={FASTRR_ASSETS.script} />
        )}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <DeferredStylesheet href={GOOGLE_FONTS_STYLESHEET} />
        {data.fastrrSellerDomain && (
          <DeferredStylesheet href={FASTRR_ASSETS.stylesheet} />
        )}
        {data.checkoutProvider === 'razorpay' && data.checkoutReady && (
          <Script waitForHydration src={RAZORPAY_ASSETS.script} />
        )}
        <ShopifyChat storeDomain={data.chatShopDomain} />
      </body>
    </html>
  );
}

function DeferredStylesheet({href}: {href: string}) {
  useEffect(() => {
    const existing = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ).some((link) => link.href === href);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [href]);

  return null;
}

function ShopifyChat({storeDomain}: {storeDomain: string}) {
  // Web components can mutate their host nodes before React hydrates server markup.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let disposed = false;
    let idleHandle: number | undefined;
    let warmupTimer: number | undefined;
    let layoutProbeTimer: number | undefined;
    let chatCloseTimer: number | undefined;
    let layoutProbeCount = 0;
    const watchedFrames = new Set<HTMLIFrameElement>();
    const escapeBoundDocuments = new WeakSet<Document>();
    const styledChatRoots = new WeakSet<ShadowRoot>();
    const styledConversationRoots = new WeakSet<ShadowRoot>();
    let pageScrollPosition: number | null = null;
    const originalRootOverflow = {
      value: document.documentElement.style.getPropertyValue('overflow'),
      priority: document.documentElement.style.getPropertyPriority('overflow'),
    };
    const originalBodyPaddingRight = {
      value: document.body.style.getPropertyValue('padding-right'),
      priority: document.body.style.getPropertyPriority('padding-right'),
    };

    const setPageScrollLocked = (locked: boolean) => {
      if (locked) {
        if (pageScrollPosition !== null) return;

        pageScrollPosition = window.scrollY;
        const scrollbarWidth =
          window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty('overflow', 'hidden');
        if (scrollbarWidth > 0) {
          const currentPaddingRight = Number.parseFloat(
            getComputedStyle(document.body).paddingRight,
          );
          document.body.style.setProperty(
            'padding-right',
            `${currentPaddingRight + scrollbarWidth}px`,
          );
        }
        return;
      }

      if (pageScrollPosition === null) return;

      const previousScrollPosition = pageScrollPosition;
      pageScrollPosition = null;
      if (originalRootOverflow.value) {
        document.documentElement.style.setProperty(
          'overflow',
          originalRootOverflow.value,
          originalRootOverflow.priority,
        );
      } else {
        document.documentElement.style.removeProperty('overflow');
      }
      if (originalBodyPaddingRight.value) {
        document.body.style.setProperty(
          'padding-right',
          originalBodyPaddingRight.value,
          originalBodyPaddingRight.priority,
        );
      } else {
        document.body.style.removeProperty('padding-right');
      }
      window.scrollTo(0, previousScrollPosition);
    };

    const closeChatOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const chat = document.querySelector<
        HTMLElement & {close?: () => void}
      >('shopify-chat');
      if (!chat?.hasAttribute('open')) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof chat.close === 'function') chat.close();
      else chat.removeAttribute('open');
    };

    const findInOpenShadowRoots = <T extends Element,>(
      root: Document | ShadowRoot,
      selector: string,
    ): T | null => {
      const directMatch = root.querySelector<T>(selector);
      if (directMatch) return directMatch;

      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        if (!element.shadowRoot) continue;
        const nestedMatch = findInOpenShadowRoots<T>(element.shadowRoot, selector);
        if (nestedMatch) return nestedMatch;
      }

      return null;
    };

    const installTopComposerLayout = () => {
      const chat = document.querySelector<HTMLElement>('shopify-chat');
      if (!chat?.shadowRoot) return false;

      const runtime = findInOpenShadowRoots<HTMLElement>(
        chat.shadowRoot,
        'shopify-agent-runtime',
      );
      const panelRoot = runtime?.shadowRoot;
      if (!panelRoot) return false;

      if (!styledChatRoots.has(panelRoot)) {
        try {
          const panelSheet = new CSSStyleSheet();
          panelSheet.replaceSync(SHOPIFY_CHAT_TOP_PANEL_CSS);
          panelRoot.adoptedStyleSheets = [
            ...panelRoot.adoptedStyleSheets,
            panelSheet,
          ];
        } catch {
          if (!panelRoot.getElementById(SHOPIFY_CHAT_TOP_PANEL_STYLE_ID)) {
            const style = document.createElement('style');
            style.id = SHOPIFY_CHAT_TOP_PANEL_STYLE_ID;
            style.textContent = SHOPIFY_CHAT_TOP_PANEL_CSS;
            panelRoot.appendChild(style);
          }
        }
        styledChatRoots.add(panelRoot);
      }

      const iframe = findInOpenShadowRoots<HTMLIFrameElement>(
        chat.shadowRoot,
        'iframe[part="iframe"]',
      );
      if (!iframe) return false;

      if (!watchedFrames.has(iframe)) {
        iframe.addEventListener('load', startLayoutProbe);
        watchedFrames.add(iframe);
      }

      let iframeDocument: Document | null = null;
      try {
        iframeDocument = iframe.contentDocument;
      } catch {
        return false;
      }
      if (!iframeDocument) return false;

      if (!escapeBoundDocuments.has(iframeDocument)) {
        iframeDocument.addEventListener('keydown', closeChatOnEscape, true);
        escapeBoundDocuments.add(iframeDocument);
      }

      const conversation = findInOpenShadowRoots<HTMLElement>(
        iframeDocument,
        'shopify-chat-conversation',
      );
      const conversationRoot = conversation?.shadowRoot;
      if (!conversationRoot) return false;

      const chatLayout = conversationRoot.querySelector<HTMLElement>('.chat');
      const composer = conversationRoot.querySelector<HTMLElement>('.composer');
      const scrollContainer =
        conversationRoot.querySelector<HTMLElement>('.scroll-container');
      if (!chatLayout || !composer || !scrollContainer) return false;

      if (!styledConversationRoots.has(conversationRoot)) {
        try {
          const ChatStyleSheet = iframeDocument.defaultView?.CSSStyleSheet;
          if (!ChatStyleSheet) throw new Error('Constructed stylesheets unavailable');

          const layoutSheet = new ChatStyleSheet();
          layoutSheet.replaceSync(SHOPIFY_CHAT_TOP_COMPOSER_CSS);
          conversationRoot.adoptedStyleSheets = [
            ...conversationRoot.adoptedStyleSheets,
            layoutSheet,
          ];
        } catch {
          if (!conversationRoot.getElementById(SHOPIFY_CHAT_TOP_COMPOSER_STYLE_ID)) {
            const style = iframeDocument.createElement('style');
            style.id = SHOPIFY_CHAT_TOP_COMPOSER_STYLE_ID;
            style.textContent = SHOPIFY_CHAT_TOP_COMPOSER_CSS;
            conversationRoot.appendChild(style);
          }
        }
        styledConversationRoots.add(conversationRoot);
      }

      // Keep the critical layout inline as well. Shopify's runtime can append
      // component styles after the shadow root is created, so stylesheet order
      // alone is not reliable across chat releases.
      chatLayout.style.setProperty(
        'grid-template-rows',
        'auto minmax(0, 1fr)',
        'important',
      );
      composer.style.setProperty('grid-row', '1', 'important');
      composer.style.setProperty('align-self', 'start', 'important');
      composer.style.setProperty(
        'margin-top',
        'var(--private-panel-header-height)',
        'important',
      );
      scrollContainer.style.setProperty('grid-row', '2', 'important');
      scrollContainer.style.setProperty('min-height', '0', 'important');

      conversation?.setAttribute('data-composer-position', 'top');
      return true;
    };

    function startLayoutProbe() {
      if (disposed) return;
      if (layoutProbeTimer !== undefined) window.clearInterval(layoutProbeTimer);
      layoutProbeCount = 0;

      const probe = () => {
        layoutProbeCount += 1;
        const complete =
          installTopComposerLayout() ||
          layoutProbeCount >= SHOPIFY_CHAT_LAYOUT_PROBE_LIMIT;
        if (complete) {
          if (layoutProbeTimer !== undefined) {
            window.clearInterval(layoutProbeTimer);
            layoutProbeTimer = undefined;
          }
        }
        return complete;
      };

      if (!probe()) {
        layoutProbeTimer = window.setInterval(probe, SHOPIFY_CHAT_LAYOUT_PROBE_MS);
      }
    }

    const openObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'open')) {
        const chat = document.querySelector<HTMLElement>('shopify-chat');
        if (chat?.hasAttribute('open') && chat.dataset.prewarming !== 'true') {
          if (chatCloseTimer !== undefined) {
            window.clearTimeout(chatCloseTimer);
            chatCloseTimer = undefined;
          }
          setPageScrollLocked(true);
          document.documentElement.dataset.shopifyChatOpen = 'true';
        } else if (!chat?.hasAttribute('open')) {
          if (chatCloseTimer !== undefined) {
            window.clearTimeout(chatCloseTimer);
          }
          chatCloseTimer = window.setTimeout(() => {
            setPageScrollLocked(false);
            delete document.documentElement.dataset.shopifyChatOpen;
            chatCloseTimer = undefined;
          }, SHOPIFY_CHAT_CLOSE_ANIMATION_MS);
        }
        startLayoutProbe();
      }
    });
    window.addEventListener('keydown', closeChatOnEscape, true);
    const revealTimer = window.setTimeout(() => {
      const chat = document.querySelector<HTMLElement>('shopify-chat');
      if (chat?.dataset.prewarming === 'true') {
        chat.removeAttribute('open');
        chat.removeAttribute('data-prewarming');
      }
    }, SHOPIFY_CHAT_REVEAL_FALLBACK_MS);

    const warmChat = () => {
      const chat = document.querySelector<HTMLElement>('shopify-chat');
      if (disposed || !chat || chat.dataset.prewarmStarted === 'true') return;

      chat.dataset.prewarmStarted = 'true';
      chat.setAttribute('open', '');

      warmupTimer = window.setTimeout(() => {
        if (disposed) return;
        chat.removeAttribute('open');
        chat.removeAttribute('data-prewarming');
        chat.dataset.prewarmed = 'true';
      }, SHOPIFY_CHAT_WARMUP_MS);
    };

    void customElements.whenDefined('shopify-chat').then(() => {
      if (disposed) return;

      const chat = document.querySelector<HTMLElement>('shopify-chat');
      if (chat) openObserver.observe(chat, {attributes: true});
      startLayoutProbe();

      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(warmChat, {timeout: 1_000});
      } else {
        idleHandle = window.setTimeout(warmChat, 0);
      }
    });

    if (!document.querySelector('script[data-shopify-chat-script]')) {
      // Hydrogen's lazy Script path applies attributes after inserting the
      // element. A module must have its type set before insertion, otherwise the
      // browser prepares chat.js as a classic script and rejects import.meta.
      const script = document.createElement('script');
      script.type = 'module';
      script.crossOrigin = 'anonymous';
      script.src = SHOPIFY_CHAT_SCRIPT;
      script.dataset.shopifyChatScript = 'true';
      document.body.appendChild(script);
    }

    return () => {
      disposed = true;
      const chat = document.querySelector<HTMLElement>('shopify-chat');
      chat?.removeAttribute('open');
      chat?.removeAttribute('data-prewarming');
      setPageScrollLocked(false);
      delete document.documentElement.dataset.shopifyChatOpen;
      window.clearTimeout(revealTimer);
      if (warmupTimer !== undefined) window.clearTimeout(warmupTimer);
      if (layoutProbeTimer !== undefined) window.clearInterval(layoutProbeTimer);
      if (chatCloseTimer !== undefined) window.clearTimeout(chatCloseTimer);
      if (idleHandle !== undefined) {
        if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
      openObserver.disconnect();
      window.removeEventListener('keydown', closeChatOnEscape, true);
      watchedFrames.forEach((iframe) => {
        iframe.removeEventListener('load', startLayoutProbe);
        iframe.contentDocument?.removeEventListener(
          'keydown',
          closeChatOnEscape,
          true,
        );
      });
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <script
        id="shopify-chat-app-embed-data"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html:
            '{"settings":{"horizontalPosition":"right","invertActivatorColors":true}}',
        }}
      />
      <shopify-store store-domain={storeDomain} country="IN" language="en">
        <shopify-chat mode="standalone" data-prewarming="true" />
      </shopify-store>
    </>
  );
}
