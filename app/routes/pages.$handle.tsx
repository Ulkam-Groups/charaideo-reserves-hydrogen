import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import aboutHeritage from '../../river-thread-web/svg/about-heritage.svg?url';
import contactThread from '../../river-thread-web/svg/contact-hospitality.svg?url';
import kamalikaPortrait from '../assets/founder-kamalika-420.jpg';
import {sanitizeStorefrontHtml} from '~/lib/html.server';

export const meta: Route.MetaFunction = ({data}) => {
  const description =
    data?.isStaticPage && 'excerpt' in data.page
      ? data.page.seo?.description ?? data.page.excerpt
      : data?.page.seo?.description ?? '';

  return [
    {title: `${data?.page.title ?? 'Page'} | Charaideo Reserves`},
    {
      name: 'description',
      content: description,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request, params}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  const staticPage = STATIC_PAGES[params.handle];
  if (staticPage) {
    return {
      page: staticPage,
      isStaticPage: true,
    };
  }

  const [{page}] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      variables: {
        handle: params.handle,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  return {
    page: {...page, body: sanitizeStorefrontHtml(page.body)},
    isStaticPage: false,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Page() {
  const {page, isStaticPage} = useLoaderData<typeof loader>();

  if (isStaticPage) {
    return <StaticPage page={page as StaticPageContent} />;
  }

  return (
    <div className="page">
      <header>
        <h1>{page.title}</h1>
      </header>
      <main dangerouslySetInnerHTML={{__html: page.body}} />
    </div>
  );
}

type StaticPageContent = {
  handle: string;
  id: string;
  title: string;
  excerpt: string;
  hero: string;
  body: string;
  sections: {eyebrow: string; title: string; body: string}[];
  cta?: {label: string; to: string};
  seo?: {description?: string; title?: string};
};

function StaticPage({page}: {page: StaticPageContent}) {
  if (page.handle === 'about-us') {
    return <AboutStoryPage page={page} />;
  }

  const heroArt = contactThread;
  return (
    <div className={`content-page content-page-${page.handle}`}>
      <section className="content-hero">
        <div className="content-hero-copy">
          <span className="eyebrow">{page.hero}</span>
          <h1>{page.title}</h1>
          <p>{page.excerpt}</p>
          {page.cta && (
            <Link className="button primary" to={page.cta.to}>
              {page.cta.label}
            </Link>
          )}
        </div>
        <img src={heroArt} width="1600" height="600" alt="" />
      </section>

      <section className="content-body">
        <p>{page.body}</p>
        <div className="content-section-grid">
          {page.sections.map((section, index) => (
            <article key={section.title}>
              <span>{String(index + 1).padStart(2, '0')} / {section.eyebrow}</span>
              <h2>{section.title}</h2>
              <p>{section.eyebrow === 'Email' ? <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com &#8599;</a> : section.eyebrow === 'Phone' ? <a href="tel:+918431988910">{section.body} &#8599;</a> : section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AboutStoryPage({page}: {page: StaticPageContent}) {
  const mission = page.sections.find((section) => section.eyebrow === 'Mission');
  const vision = page.sections.find((section) => section.eyebrow === 'Vision');
  const culturalMemory = page.sections.find((section) => section.eyebrow === 'Cultural memory');

  return (
    <div className="content-page content-page-about-us">
      <section className="about-story">
        <figure className="about-story-visual">
          <div className="about-story-frame">
            <img
              src={aboutHeritage}
              width="1600"
              height="600"
              alt="Preserved heritage, carried forward - the Charaideo River Thread"
            />
          </div>
          <figcaption>River Thread / Assam / 26.98° N</figcaption>
        </figure>

        <div className="about-story-copy">
          <span className="eyebrow">Our story</span>
          <h1>Rooted in Assam.<br /><em>Inspired by heritage.</em></h1>
          <p className="about-story-intro">Charaideo was born from a deep emotional connection to Assam-its land, its culture, and its timeless tea legacy.</p>

          <blockquote>
            <p>Growing up in a family of tea planters, tea was never simply a profession for my family; it was a way of life. Some of my earliest memories are woven into the tea gardens of Assam-walking through endless green estates, visiting tea factories with my father, and witnessing the journey from leaf to cup. Those experiences created a bond with the land that only grew stronger with time.</p>
            <p>No matter where life led me, Assam always remained home. While building a corporate career, I carried a quiet dream within me: to return to my roots and create something that would honour the heritage I was raised with. That dream eventually became Charaideo.</p>
            <p>Leaving the corporate world was more than a career change; it was a conscious decision to return to the soil, stories, and traditions that shaped my identity. Through Charaideo, I want to carry the spirit of Assam forward-blending heritage with contemporary craftsmanship to create teas that feel authentic, meaningful, and deeply connected to their origin.</p>
          </blockquote>

          <ol className="about-story-timeline" aria-label="Charaideo Reserves story">
            <li><span>1990</span><h2>Family Roots in Rupai, Tinsukia</h2><p>Our family’s relationship with Assam tea took root in garden cultivation-hand-plucking fresh leaves at dawn and learning to respect the land, its people, and its bold, unmistakable character.</p></li>
            <li><span>2026</span><h2>Charaideo - Born in Assam, Shared with the World</h2><p>A return to roots. Charaideo was created to bring the spirit of Assam to modern tea lovers around the world through teas that are authentic, meaningful, and deeply connected to their origin.</p></li>
          </ol>

          {page.cta && <Link className="button primary" to={page.cta.to}>{page.cta.label} <span aria-hidden="true">↗</span></Link>}
        </div>
      </section>

      <section className="about-purpose">
        <header className="about-purpose-heading">
          <span className="eyebrow">Our purpose</span>
          <h2>Mission &amp; Vision</h2>
          <i aria-hidden="true" />
        </header>

        <div className="about-purpose-cards">
          {[mission, vision].map((section, index) => section && (
            <article key={section.title}>
              <span className="about-purpose-icon" aria-hidden="true">{index === 0 ? '◇' : '⊙'}</span>
              <small>{section.eyebrow}</small>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>

        <div className="about-founder">
          <span className="eyebrow">The people</span>
          <h2>Meet the Founder</h2>
          <p>The woman behind the Assam tea legacy.</p>
          <a className="about-founder-portrait" href="https://in.linkedin.com/in/kamalika-biswas" target="_blank" rel="noopener noreferrer" aria-label="Kamalika Biswas on LinkedIn">
            <img src={kamalikaPortrait} width="420" height="420" loading="lazy" decoding="async" alt="Kamalika Biswas, founder and CEO of Charaideo Reserves" />
          </a>
          <h3>Kamalika Biswas</h3>
          <strong>Founder &amp; CEO</strong>
          <p>Founder of Ulkam Group, carrying Assam’s tea heritage to the world through Charaideo Reserves.</p>
          <a className="founder-linkedin" href="https://in.linkedin.com/in/kamalika-biswas" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">in</span> LinkedIn</a>
        </div>
      </section>

      <section className="content-body about-story-more">
        <p>{page.excerpt}</p>
        <div className="content-section-grid">
          {culturalMemory && <article>
            <span>01 / {culturalMemory.eyebrow}</span>
            <h2>{culturalMemory.title}</h2>
            <p>{culturalMemory.body}</p>
          </article>}
        </div>
      </section>
    </div>
  );
}

const STATIC_PAGES: Record<string, StaticPageContent> = {
  contact: {
    handle: 'contact',
    id: 'static-contact',
    title: 'Let\u2019s put the kettle on.',
    hero: 'A conversation starts here',
    excerpt:
      "Whether you're a customer, retailer, or tea enthusiast, we would love to hear from you.",
    body:
      'Get in touch with Ulkam Group for Assam tea product questions, order support, or general information about Charaideo Reserves teas.',
    sections: [
      {
        eyebrow: 'Address',
        title: 'Rupai Siding, Assam',
        body: 'Ownguri Gaon, Rupai Siding, Assam 786153, India.',
      },
      {
        eyebrow: 'Email',
        title: 'Write to us',
        body: 'kamalika@ulkamgroup.com or contact@ulkamgroup.com',
      },
      {
        eyebrow: 'Phone',
        title: 'Call us',
        body: '+91 84319 88910',
      },
      {
        eyebrow: 'Hours',
        title: 'Business hours',
        body: 'Monday to Saturday, 9:00 AM to 6:00 PM IST. Sunday closed.',
      },
    ],
    cta: {label: 'Shop teas', to: '/collections/all'},
    seo: {
      description:
        'Contact Charaideo Reserves for Assam tea orders, product questions, and customer support.',
    },
  },
  'about-us': {
    handle: 'about-us',
    id: 'static-about-us',
    title: 'A place. A people. A pot of tea.',
    hero: 'Our story / Assam, North East India',
    excerpt:
      'Bringing Assam tea culture to the world. Bringing North East Indian heritage back to the table.',
    body:
      'Charaideo was born from a deep emotional connection to Assam, its land, its culture, and its timeless tea legacy. Growing up in a family of tea planters, tea was never simply a profession; it was a way of life.',
    sections: [
      {
        eyebrow: 'Cultural memory',
        title: 'A name that remembers',
        body: 'Charaideo and the Ahom legacy live in the cultural memory of Assam. Our name is an invitation to carry that memory into the everyday: a shared table, a conversation, a cup of tea.',
      },
      {
        eyebrow: 'Mission',
        title: 'To bring Assam to every table',
        body: 'To preserve and promote the rich tea heritage of Assam through ethically sourced and carefully curated teas that respect the land and people connected to tea cultivation.',
      },
      {
        eyebrow: 'Vision',
        title: "Assam's soul, the world's cup",
        body: 'To bring the soul of Assam to the world through authentic, thoughtfully crafted teas that honour heritage, celebrate culture, and connect tradition with modern living.',
      },
      {
        eyebrow: 'Founder',
        title: 'Kamalika Biswas',
        body: 'Founder of Ulkam Group, driving the vision to bring the finest Assam teas to the world through Charaideo Reserves.',
      },
    ],
    cta: {label: 'Browse catalog', to: '/collections/all'},
    seo: {
      description:
        'Learn about Charaideo Reserves, an Assam-origin tea storefront offering orthodox, CTC, spiced, and blended teas.',
    },
  },
};

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
` as const;
