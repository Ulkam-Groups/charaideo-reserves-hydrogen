import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';

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
    page,
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
  return (
    <div className={`content-page content-page-${page.handle}`}>
      <section className="content-hero">
        <div>
          <span className="eyebrow">{page.hero}</span>
          <h1>{page.title}</h1>
          <p>{page.excerpt}</p>
          {page.cta && (
            <Link className="button primary" to={page.cta.to}>
              {page.cta.label}
            </Link>
          )}
        </div>
      </section>

      <section className="content-body">
        <p>{page.body}</p>
        <div className="content-section-grid">
          {page.sections.map((section) => (
            <article key={section.title}>
              <span>{section.eyebrow}</span>
              <h2>{section.title}</h2>
              <p>{section.eyebrow === 'Email' ? <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com &#8599;</a> : section.eyebrow === 'Phone' ? <a href="tel:+918431988910">{section.body} &#8599;</a> : section.body}</p>
            </article>
          ))}
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
