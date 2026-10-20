import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/pages.$handle';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import kamalikaPortrait from '../assets/founder-kamalika-420.jpg';
import aboutHeroImage from '../assets/about-charaideo-reserves-hero.png';
import aboutStoryStylesheet from '~/styles/about-story-page.css?url';
import {sanitizeStorefrontHtml} from '~/lib/html.server';
import {JourneyMap, NewsletterSignup} from '~/components/AboutStoryExtras';

export const links: Route.LinksFunction = () => [
  {rel: 'stylesheet', href: aboutStoryStylesheet},
];

export const meta: Route.MetaFunction = ({data}) => {
  const description =
    data?.isStaticPage && 'excerpt' in data.page
      ? (data.page.seo?.description ?? data.page.excerpt)
      : (data?.page.seo?.description ?? '');

  return [
    {title: `${data?.page.title ?? 'Page'} | Charaideo Reserves™`},
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
    return <AboutStoryPage />;
  }

  if (page.handle === 'contact') {
    return <ContactPage page={page} />;
  }

  return (
    <div className={`content-page content-page-${page.handle}`}>
      <section className="content-hero">
        <div className="content-hero-copy">
          <span className="eyebrow">{page.hero}</span>
          <h1>{page.title}</h1>
          <p>{page.excerpt}</p>
          {page.cta && (
            <Link className="button primary" prefetch="none" to={page.cta.to}>
              {page.cta.label}
            </Link>
          )}
        </div>
        <div className="revamp-hero-art contact-hero-art" aria-hidden="true">
          <span className="contact-art-kicker">A note from Assam</span>
          <span className="contact-art-heading">
            The conversation
            <br />
            starts here.
          </span>
          <span className="contact-art-footer">Charaideo Reserves · Rupai Siding</span>
        </div>
      </section>

      <section className="content-body">
        <p>{page.body}</p>
        <div className="content-section-grid">
          {page.sections.map((section, index) => (
            <article key={section.title}>
              <span>
                {String(index + 1).padStart(2, '0')} / {section.eyebrow}
              </span>
              <h2>{section.title}</h2>
              <p>
                {section.eyebrow === 'Email' ? (
                  <>
                    <a href="mailto:kamalika@ulkamgroup.com">
                      kamalika@ulkamgroup.com &#8599;
                    </a>
                    <a href="mailto:contact@ulkamgroup.com">
                      contact@ulkamgroup.com &#8599;
                    </a>
                  </>
                ) : section.eyebrow === 'Phone' ? (
                  <a href="tel:+918431988910">{section.body} &#8599;</a>
                ) : (
                  section.body
                )}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ContactPage({page}: {page: StaticPageContent}) {
  const socialLinks = [
    {
      label: 'Instagram',
      handle: '@charaideo.reserves',
      href: 'https://www.instagram.com/charaideo.reserves/',
    },
    {
      label: 'Facebook',
      handle: 'Charaideo Reserves',
      href: 'https://www.facebook.com/profile.php?id=61595061842649',
    },
    {
      label: 'LinkedIn',
      handle: 'Charaideo Reserves',
      href: 'https://www.linkedin.com/showcase/charaideo-reserves',
    },
  ];

  const faqs = [
    {
      question: 'Where is my order?',
      answer:
        'Email contact@ulkamgroup.com with your order number and we will share the latest tracking update.',
    },
    {
      question: 'Do you take wholesale or gifting enquiries?',
      answer:
        'Yes. Write to us with your quantities and timeline, and our team will reply within one business day.',
    },
    {
      question: 'Can I visit the estate?',
      answer:
        'We are based in Rupai Siding, Assam. Call ahead so we can plan your visit.',
    },
    {
      question: 'How do I return or exchange a tea?',
      answer:
        'Our Refund Policy covers the details; for help with a specific order, contact us.',
    },
  ];

  return (
    <main className="contact-page">
      <section className="contact-intro">
        <div className="contact-intro-copy">
          <span className="eyebrow">{page.hero}</span>
          <h1>Let&rsquo;s start a conversation.</h1>
          <p>{page.excerpt}</p>
          <div className="contact-intro-actions">
            <a className="button primary" href="mailto:contact@ulkamgroup.com">
              Email our team
            </a>
            <a className="contact-text-link" href="tel:+918431988910">
              +91 84319 88910 <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </div>
        <aside className="contact-intro-note" aria-label="Our promise">
          <span>From the tea country</span>
          <p>
            Product questions, order support, wholesale enquiries, or simply a
            shared love of Assam tea&mdash;our team is here to help.
          </p>
          <small>We usually reply within one business day.</small>
        </aside>
      </section>

      <section className="contact-details" aria-labelledby="contact-details-title">
        <div className="contact-section-heading">
          <span className="eyebrow">Ways to reach us</span>
          <h2 id="contact-details-title">Choose what works for you.</h2>
        </div>
        <div className="contact-card-grid">
          <article>
            <span className="contact-card-number">01</span>
            <h3>Email</h3>
            <p>For orders, products, partnerships, and general enquiries.</p>
            <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a>
            <a href="mailto:kamalika@ulkamgroup.com">kamalika@ulkamgroup.com</a>
          </article>
          <article>
            <span className="contact-card-number">02</span>
            <h3>Call</h3>
            <p>Monday&ndash;Friday, 10:00 AM&ndash;4:00 PM IST.</p>
            <a href="tel:+918431988910">+91 84319 88910</a>
          </article>
          <article>
            <span className="contact-card-number">03</span>
            <h3>Visit</h3>
            <p>Ownguri Gaon, Rupai Siding, Assam 786153, India.</p>
            <a href="https://maps.app.goo.gl/ZTk13bPuNgmt1kBy5" target="_blank" rel="noreferrer">
              Get directions <span aria-hidden="true">&#8599;</span>
            </a>
          </article>
        </div>
      </section>

      <section className="contact-location" aria-labelledby="contact-location-title">
        <div className="contact-location-content">
          <span className="eyebrow">Find us in Assam</span>
          <h2 id="contact-location-title">
            At home in tea country.
            <br />
            <em>Come find us in Rupai Siding.</em>
          </h2>
          <p>
            Charaideo Reserves is based in Rupai Siding, in the heart of Upper
            Assam. Open the map for turn-by-turn directions to our location.
          </p>
        </div>
        <div className="contact-map">
          <iframe
            title="Charaideo Reserves location in Rupai Siding, Assam"
            src="https://www.google.com/maps?q=27.6012775%2C95.5496621&z=17&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        <span className="contact-location-seal" aria-hidden="true">
          <svg viewBox="100 104 130 150" fill="none" focusable="false">
            <path
              d="M106.5 110.5H216.498L223.482 121.849H143.166C142.293 124.468 142.293 127.087 144.912 130.579C150.15 137.563 156.261 141.055 164.118 145.42C172.848 149.785 180.705 152.404 188.562 155.023C195.546 155.896 200.784 159.388 205.149 165.499C207.768 168.991 208.641 174.229 208.641 179.467C208.641 190.816 204.276 203.038 199.038 212.641C192.927 222.244 182.451 231.847 170.229 235.339C163.245 237.958 152.769 236.212 145.785 233.593C136.182 230.101 131.817 224.863 130.071 217.879C129.198 215.26 129.198 213.514 129.198 210.022V122.722L114.357 121.849L106.5 110.5ZM142.293 142.801C145.785 148.039 151.023 154.15 156.261 159.388C164.118 165.499 172.848 169.864 180.705 171.61C184.197 172.483 185.943 172.483 187.689 174.229C188.562 177.721 187.689 182.086 186.816 185.578C185.07 195.181 180.705 203.038 174.594 210.022C169.356 215.26 163.245 219.625 158.88 220.498C154.515 221.371 150.15 219.625 146.658 217.006C144.039 215.26 142.293 213.514 142.293 210.895V142.801Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
          <small>ASSAM</small>
          <strong>26.98<sup>&deg;</sup></strong>
        </span>
      </section>

      <section className="contact-faq" aria-labelledby="contact-faq-title">
        <div>
          <span className="eyebrow">Quick answers</span>
          <h2 id="contact-faq-title">Before you write.</h2>
        </div>
        <div className="contact-faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="contact-social" aria-labelledby="contact-social-title">
        <div>
          <span className="eyebrow">Follow the journey</span>
          <h2 id="contact-social-title">Stories from the reserve.</h2>
        </div>
        <div className="contact-social-links">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              className={`social-link-${social.label.toLowerCase()}`}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Follow Charaideo Reserves on ${social.label}`}
              title={social.label}
            >
              <SocialIcon platform={social.label} />
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function SocialIcon({platform}: {platform: string}) {
  if (platform === 'Instagram') {
    return (
      <svg className="social-icon-instagram" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="instagram-gradient" x1="2" y1="22" x2="22" y2="2">
            <stop offset="0" stopColor="#feda75" />
            <stop offset="0.35" stopColor="#fa7e1e" />
            <stop offset="0.62" stopColor="#d62976" />
            <stop offset="0.82" stopColor="#962fbf" />
            <stop offset="1" stopColor="#4f5bd5" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" />
      </svg>
    );
  }

  if (platform === 'Facebook') {
    return (
      <svg className="social-icon-solid social-icon-facebook" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 8H17V4.4c-.43-.06-1.9-.18-3.64-.18-3.6 0-6.07 2.2-6.07 6.25V14H3.2v4.03h4.09V24h5.02v-5.97h4.18L17.15 14h-4.84v-3.13C12.31 9.7 12.63 8 14.5 8Z" />
      </svg>
    );
  }

  return (
    <svg className="social-icon-solid social-icon-linkedin" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="4" height="12" />
      <circle cx="5" cy="5" r="2" />
      <path d="M10 9h4v1.7c.8-1.2 2-2.1 4.1-2.1 3.5 0 3.9 2.5 3.9 5.7V21h-4v-6c0-1.45-.03-3.3-2-3.3-2 0-2.3 1.56-2.3 3.2V21H10V9Z" />
    </svg>
  );
}

function AboutStoryPage() {
  return (
    <main className="content-page content-page-about-us about-page">
      <section className="about-page-hero" aria-labelledby="about-page-title">
        <div className="about-page-hero-copy">
          <p className="about-page-kicker">Our story</p>
          <h1 id="about-page-title">
            Every Tea Has a Place.
            <em>Every Place Has a Story.</em>
          </h1>
          <p className="about-page-hero-intro">
            Charaideo Reserves began with my personal connection to Assam, a lifelong familiarity with tea, and a desire to share its many distinctive expressions with the world.
          </p>
        </div>

        <figure className="about-page-hero-media">
          <img
            src={aboutHeroImage}
            width="2048"
            height="2048"
            loading="eager"
            alt="Charaideo Reserves emblem embossed on textured paper with Assamese-inspired botanical detailing"
          />
        </figure>
      </section>

      <section className="about-page-story" aria-labelledby="story-title">
        <div className="about-page-story-copy">
          <p className="about-page-kicker">Our story</p>
          <h2 id="story-title">A Story That Was Always There.</h2>
          <p>
              <b><i>What Is Charaideo Reserves?</i></b>
              <br />
              CHARAIDEO RESERVES is a tea brand dedicated to curating distinctive teas from Assam, bringing together selections that express the character of their origins and the craft behind their making. Our approach goes beyond offering tea as a product. We seek to create a collection in which each tea has its own identity, chosen with care and presented with an appreciation for the place and people behind it.
          </p>
          <div className="about-page-story-prose">
            {/* <p>
              <i><b>Why Charaideo? -"চৰাইদেউ"</b></i>
              <br />
                Charaideo holds a special place in Assam’s history as the first capital of the Ahom kingdom and the site of its historic royal maidams. The name is also associated with the meaning “a dazzling city above the mountain.” We chose Charaideo to honour a significant part of Assam’s cultural heritage and to give our brand a name that carries a sense of history, identity and place.
                <br />
            </p>
            <p>
              <b><i>Why Reserves?</i></b>
              <br />
                  For us, Reserves represents a thoughtfully curated collection rather than a catalogue of interchangeable teas. Each selection earns its place through its distinct character, origin or craftsmanship. The word reflects our intention to bring together teas with a clear reason for being chosen, allowing each one to be appreciated on its own merits while forming part of a considered collection.
              <br />
            </p> */}
          </div>
          <p className="about-page-story-quote">
             Charaideo (চৰাইদেউ) is pronounced as in Assamese "so-rai-deo" or "xo-rai-deo".
          </p>
        </div>
        <div className="about-page-roots">
          <article>
            <p className="about-page-kicker">Where it all began</p>
            <h3>Why Charaideo? -"চৰাইদেউ"</h3>
            <p>
                Charaideo holds a special place in Assam’s history as the first capital of the Ahom kingdom and the site of its historic royal maidams. The name is also associated with the meaning “a dazzling city above the mountain.” We chose Charaideo to honour a significant part of Assam’s cultural heritage and to give our brand a name that carries a sense of history, identity and place.
                <br />
            </p>
          </article>
          <article>
            <p className="about-page-kicker">A Tea vault, not just a brand</p>
            <h3>Why Reserves?</h3>
            <p>
                  For us, Reserves represents a thoughtfully curated collection rather than a catalogue of interchangeable teas. Each selection earns its place through its distinct character, origin or craftsmanship. The word reflects our intention to bring together teas with a clear reason for being chosen, allowing each one to be appreciated on its own merits while forming part of a considered collection.
              <br />
            </p>
          </article>
        </div>
      </section>

      <section className="about-page-founder" aria-labelledby="founder-title">
        <div className="about-page-founder-panel">
          <div className="about-page-founder-portrait">
            <img
              src={kamalikaPortrait}
              width="420"
              height="420"
              loading="lazy"
              decoding="async"
              alt="Kamalika Biswas, founder and CEO of Charaideo Reserves"
            />
          </div>
          <div className="about-page-founder-copy">
            <p className="about-page-kicker">The people</p>
            <h2 id="founder-title">Meet the Founder</h2>
            <h3>Kamalika Biswas - Founder &amp; CEO</h3>
            <p>
              Founder of Ulkam Group and a daughter of Assam&apos;s tea soil, Kamalika left
              her corporate career to return to her family&apos;s legacy in Rupai. Through
              Charaideo Reserves, she carries forward three generations of tea heritage -
              with a woman&apos;s perspective, a founder&apos;s grit, and a deep respect for
              the land that raised her.
            </p>
            <blockquote className="about-page-founder-quote">
              <p>
                Tea was never simply a profession for my family. It was a way of life.
              </p>
              <footer>
                <span className="about-page-signature" aria-hidden="true">
                  Kamalika Biswas
                </span>
                <cite>Kamalika Biswas, Founder &amp; CEO</cite>
              </footer>
            </blockquote>
          </div>
        </div>

        <div className="about-page-generations" data-generations>
          <header>
            <p className="about-page-kicker">Three generations of tea</p>
            <h3>A legacy handed down, not started.</h3>
          </header>
          <ol>
            <li>
              <span className="about-page-generation-mark">I</span>
              <h4>The garden</h4>
              <p>
                Our family&apos;s tea story begins in Rupai with cultivation: hand-plucking
                at dawn and respecting the land and its people.
              </p>
            </li>
            <li>
              <span className="about-page-generation-mark">II</span>
              <h4>The factory floor</h4>
              <p>
                Tea became a way of life. Days spent in the gardens and tea factories,
                watching leaf become cup.
              </p>
            </li>
            <li>
              <span className="about-page-generation-mark">III</span>
              <h4>The homecoming</h4>
              <p>
                A corporate career, then a return to Rupai, and Charaideo Reserves: single
                gardens, traceable and named.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="about-page-purpose" aria-labelledby="purpose-title">
        <header>
          <p className="about-page-kicker">Our purpose</p>
          <h2 id="purpose-title">Mission &amp; Vision</h2>
        </header>
        <div className="about-page-purpose-grid">
          <article>
            <span>Mission</span>
            <h3>To rescue real Assam tea from the commodity market.</h3>
            <p>
              We started Charaideo because we saw the paradox: Assam grows the
              world&apos;s finest Orthodox tea, yet most Indians have never tasted it. The
              best leaves are exported, while what remains for the domestic market is
              dust, blends without origin, and CTC sold as &quot;Assam tea.&quot;
            </p>
            <p>
              Our mission is to reverse that. To bring single-garden, whole-leaf,
              traceable teas back to Indian tables - teas where you know the garden and
              estate, the pluck date, and the people behind it. Directly sourced,
              small-batch processed, and sold without disguising it in anonymous blends.
            </p>
            <p>
              We are not selling just &quot;chai&quot;. We are selling provenance, fair
              value to growers, and a ritual that remembers where it came from.
            </p>
          </article>
          <article>
            <span>Vision</span>
            <h3>A tea vault that holds culture, not just leaves.</h3>
            <p>
              Our vision is to build India&apos;s first heritage tea vault - where tea is
              treated like wine, with terroir, vintage and story. A vault named after
              Charaideo, where Ahom kings were laid to rest with reverence, because we
              believe Assam&apos;s tea heritage deserves the same reverence.
            </p>
            <p>
              We want to make consumers ask: Which garden is this from? Not just &quot;is
              it strong?&quot; To make North East heritage a daily ritual again - not an
              exotic footnote. And to ensure that the future of Assam tea is not decided
              in auction houses and export containers alone, but at Indian tables that
              finally get to taste what was always theirs.
            </p>
          </article>
        </div>
        <div className="about-page-purpose-art" aria-hidden="true">
          <svg
            className="about-page-purpose-river"
            viewBox="0 0 1440 180"
            preserveAspectRatio="none"
            focusable="false"
          >
            <path d="M-30 92 C 300 42, 845 54, 1470 145" />
          </svg>
          <span className="about-page-purpose-seal">
            <svg
              className="about-page-purpose-seal-mark"
              viewBox="100 104 130 150"
              fill="none"
              focusable="false"
            >
              <path
                d="M106.5 110.5H216.498L223.482 121.849H143.166C142.293 124.468 142.293 127.087 144.912 130.579C150.15 137.563 156.261 141.055 164.118 145.42C172.848 149.785 180.705 152.404 188.562 155.023C195.546 155.896 200.784 159.388 205.149 165.499C207.768 168.991 208.641 174.229 208.641 179.467C208.641 190.816 204.276 203.038 199.038 212.641C192.927 222.244 182.451 231.847 170.229 235.339C163.245 237.958 152.769 236.212 145.785 233.593C136.182 230.101 131.817 224.863 130.071 217.879C129.198 215.26 129.198 213.514 129.198 210.022V122.722L114.357 121.849L106.5 110.5ZM142.293 142.801C145.785 148.039 151.023 154.15 156.261 159.388C164.118 165.499 172.848 169.864 180.705 171.61C184.197 172.483 185.943 172.483 187.689 174.229C188.562 177.721 187.689 182.086 186.816 185.578C185.07 195.181 180.705 203.038 174.594 210.022C169.356 215.26 163.245 219.625 158.88 220.498C154.515 221.371 150.15 219.625 146.658 217.006C144.039 215.26 142.293 213.514 142.293 210.895V142.801Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
            <span className="about-page-purpose-place">ASSAM</span>
            <span className="about-page-purpose-coordinate">
              26.98<sup>°</sup>
            </span>
          </span>
        </div>
      </section>

      <section className="about-page-proof" aria-label="The Charaideo promise">
        <p className="about-page-proof-label">What we promise</p>
        <article>
          <span>01</span>
          <div>
            <h2>Single-Garden &amp; Traceable</h2>
            <p>Every lot QR-linked to its origin, garden and estate</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>One Estate. One Harvest.</h2>
            <p>
              Each reserve comes from a single garden and harvest - never blended,
              so its character stays true to its origin
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>Direct &amp; Ethical</h2>
            <p>
              Direct relationships with the best estates across Assam, grower-first
              pricing
            </p>
          </div>
        </article>
      </section>

      <section className="about-page-journey" aria-labelledby="journey-title">
        <header>
          <p className="about-page-kicker">Garden to cup</p>
          <h2 id="journey-title">Follow one lot from Rupai to your table.</h2>
        </header>
        <JourneyMap />
      </section>

      <section className="about-page-close" aria-labelledby="legacy-title">
        <div>
          <p className="about-page-kicker">A name that remembers</p>
          <h2 id="legacy-title">A name that remembers</h2>
          <p>
            Charaideo and the Ahom legacy live in the cultural memory of Assam. Our name
            is an invitation to carry that memory into the everyday: a shared table, a
            conversation, a cup of tea.
          </p>
        </div>
        <div className="about-page-close-signup">
          <NewsletterSignup />
        </div>
      </section>
    </main>
  );
}

const STATIC_PAGES: Record<string, StaticPageContent> = {
  contact: {
    handle: 'contact',
    id: 'static-contact',
    title: 'Keep in touch.',
    hero: 'Contact Charaideo Reserves™',
    excerpt:
      "Whether you're a customer, retailer, or tea enthusiast, we would love to hear from you.",
    body: 'Get in touch with Ulkam Group for Assam tea product questions, order support, or general information about Charaideo Reserves™ teas.',
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
    cta: {label: 'Explore the Reserve List', to: '/reserve-list'},
    seo: {
      description:
        'Contact Charaideo Reserves™ for Assam tea orders, product questions, and customer support.',
    },
  },
  'about-us': {
    handle: 'about-us',
    id: 'static-about-us',
    title: 'Our Story',
    hero: 'Our story / Assam, North-East India',
    excerpt:
      'Rooted in Assam and inspired by heritage, Charaideo Reserves preserves traceable, single-garden, whole-leaf teas.',
    body: 'Charaideo Reserves was born from a deep emotional connection to Assam, its land, its culture, and its timeless tea legacy. Growing up in a family of tea planters, tea was never simply a profession; it was a way of life.',
    sections: [
      {
        eyebrow: 'Cultural memory',
        title: 'A name that remembers',
        body: 'Charaideo Reserves draws its name from the Ahom legacy and the cultural memory of Assam. It is an invitation to carry that memory into the everyday: a shared table, a conversation, a cup of tea.',
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
        body: 'Founder of Ulkam Group, driving the vision to bring the finest Assam teas to the world through Charaideo Reserves™.',
      },
    ],
    cta: {label: 'Browse catalog', to: '/collections/all'},
    seo: {
      description:
        'Discover the Charaideo Reserves story-three generations of Assam tea heritage, a founder’s homecoming, and a mission to preserve traceable single-garden tea.',
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
