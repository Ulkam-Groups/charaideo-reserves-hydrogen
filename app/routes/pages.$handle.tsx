import {useEffect, useRef, useState} from 'react';
import {Link, useFetcher, useLoaderData} from 'react-router';
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
      turnstileSiteKey: context.env.PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '',
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
    turnstileSiteKey: '',
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
  const {page, isStaticPage, turnstileSiteKey = ''} = useLoaderData<typeof loader>();

  if (isStaticPage) {
    return <StaticPage page={page as StaticPageContent} turnstileSiteKey={turnstileSiteKey} />;
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

function StaticPage({
  page,
  turnstileSiteKey,
}: {
  page: StaticPageContent;
  turnstileSiteKey: string;
}) {
  if (page.handle === 'about-us') {
    return <AboutStoryPage />;
  }

  if (page.handle === 'contact') {
    return <ContactPage page={page} turnstileSiteKey={turnstileSiteKey} />;
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

function ContactForm({
  turnstileSiteKey,
  onClose,
  onSuccess,
}: {
  turnstileSiteKey: string;
  onClose?: () => void;
  onSuccess?: (message: string) => void;
}) {
  const fetcher = useFetcher<{ok?: boolean; message?: string; error?: string}>();
  const formRef = useRef<HTMLFormElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>();
  const [captchaToken, setCaptchaToken] = useState('');
  const [enquiryType, setEnquiryType] = useState('');
  const pending = fetcher.state !== 'idle';

  useEffect(() => {
    if (!turnstileSiteKey || !captchaRef.current) return;

    type TurnstileApi = {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          theme: string;
          size: 'flexible';
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    const turnstileWindow = window as Window & {turnstile?: TurnstileApi};
    const renderWidget = () => {
      if (!captchaRef.current || !turnstileWindow.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = turnstileWindow.turnstile.render(captchaRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'light',
        size: 'flexible',
        callback: setCaptchaToken,
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-contact-turnstile]',
    );
    if (turnstileWindow.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener('load', renderWidget, {once: true});
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.contactTurnstile = 'true';
      script.addEventListener('load', renderWidget, {once: true});
      document.head.appendChild(script);
    }

    return () => {
      existingScript?.removeEventListener('load', renderWidget);
      if (widgetIdRef.current && turnstileWindow.turnstile) {
        turnstileWindow.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (!fetcher.data?.ok) return;
    formRef.current?.reset();
    setEnquiryType('');
    const turnstile = (
      window as Window & {turnstile?: {reset: (widgetId: string) => void}}
    ).turnstile;
    if (widgetIdRef.current) turnstile?.reset(widgetIdRef.current);
    setCaptchaToken('');
    onSuccess?.(fetcher.data.message ?? 'Thank you. Your enquiry has been received.');
  }, [fetcher.data, onSuccess]);

  return (
    <section
      className={`contact-form-section${onClose ? ' contact-form-section--modal' : ''}`}
      aria-labelledby="contact-form-title"
    >
      {onClose && (
        <button className="contact-form-close" type="button" onClick={onClose} aria-label="Close contact form">
          <span aria-hidden="true">&times;</span>
        </button>
      )}
      <div className="contact-form-heading">
        <span className="eyebrow">Send us a note</span>
        <h2 id="contact-form-title">How can we help?</h2>
        <p>
          Tell us what you need and we&rsquo;ll route your message to the right person.
        </p>
        <ul className="contact-form-assurances" aria-label="Support information">
          <li>Reply within two business days</li>
        </ul>
      </div>
      <fetcher.Form ref={formRef} className="contact-form" method="post" action="/api/contact">
        <div className="contact-form-fields">
          <label>
            <span>Name</span>
            <input name="name" type="text" autoComplete="name" maxLength={100} required />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>
          <label>
            <span>Phone <small>Optional</small></span>
            <input name="phone" type="tel" autoComplete="tel" maxLength={30} />
          </label>
          <label>
            <span>Enquiry type</span>
            <select
              name="enquiryType"
              value={enquiryType}
              onChange={(event) => setEnquiryType(event.currentTarget.value)}
              required
            >
              <option value="" disabled>Select a topic</option>
              <option>Order support</option>
              <option>Product question</option>
              <option>Wholesale or gifting</option>
              <option>Visit the estate</option>
              <option>Other</option>
            </select>
          </label>
          {enquiryType === 'Order support' && (
            <label>
              <span>Order number <small>Optional</small></span>
              <input name="orderNumber" type="text" autoComplete="off" maxLength={40} />
            </label>
          )}
          <label className="contact-form-message">
            <span>Message <small>Maximum 400 characters</small></span>
            <textarea name="message" rows={4} minLength={10} maxLength={400} required />
          </label>
        </div>
        <label className="contact-form-honeypot" aria-hidden="true">
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
        {turnstileSiteKey ? (
          <>
            <div ref={captchaRef} className="contact-turnstile" />
            <input type="hidden" name="cf-turnstile-response" value={captchaToken} />
          </>
        ) : (
          <p className="contact-form-config">Contact form security is being configured.</p>
        )}
        <div className="contact-form-submit">
          <button
            className="button primary"
            type="submit"
            disabled={pending || !turnstileSiteKey || !captchaToken}
          >
            {pending ? 'Sending…' : 'Submit enquiry'}
          </button>
          <p>By submitting, you agree that we may use these details to respond to your enquiry.</p>
        </div>
        {fetcher.data?.message && !onSuccess && (
          <p className="contact-form-status success" role="status">{fetcher.data.message}</p>
        )}
        {fetcher.data?.error && (
          <p className="contact-form-status error" role="alert">{fetcher.data.error}</p>
        )}
      </fetcher.Form>
    </section>
  );
}

function ContactPage({
  page,
  turnstileSiteKey,
}: {
  page: StaticPageContent;
  turnstileSiteKey: string;
}) {
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const contactDialogRef = useRef<HTMLDialogElement>(null);
  const successDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = contactDialogRef.current;
    if (!dialog) return;
    if (contactFormOpen && !dialog.open) dialog.showModal();
    if (!contactFormOpen && dialog.open) dialog.close();
  }, [contactFormOpen]);

  useEffect(() => {
    const dialog = successDialogRef.current;
    if (!dialog) return;
    if (successMessage && !dialog.open) dialog.showModal();
    if (!successMessage && dialog.open) dialog.close();
  }, [successMessage]);

  const faqs = [
    {
      question: 'Where is my order?',
      answer:
        'Check the tracking link in your dispatch confirmation first. If tracking is unavailable or your delivery is overdue, submit an order-support enquiry with your order number so we can check it with the carrier.',
    },
    {
      question: 'Do you take wholesale or gifting enquiries?',
      answer:
        'Yes. Send an enquiry with the tea, approximate quantity, delivery location, required date, and any packaging needs. Our team will reply within two business days.',
    },
    {
      question: 'How are shipping charges and delivery estimates calculated?',
      answer:
        'Available shipping methods, charges, and delivery estimates are shown at checkout for the address you enter. Estimates may change because of the destination, carrier operations, holidays, or circumstances outside our control.',
    },
    {
      question: 'How do I return or exchange a tea?',
      answer:
        'Submit an enquiry with your order number and the reason for your request before sending anything back. We will review the product condition and order details, then share return instructions if the request is approved.',
    },
  ];

  return (
    <main className="contact-page">
      <section className="contact-intro">
        <div className="contact-intro-copy">
          <span className="eyebrow">{page.hero}</span>
          <h1>Let&rsquo;s start a conversation.</h1>
          <p>{page.excerpt}</p>
        </div>
        <aside className="contact-intro-note" aria-label="Our promise">
          <span>From the tea country</span>
          <p>
            Product questions, order support, wholesale enquiries, or simply a
            shared love of Assam tea&mdash;our team is here to help.
          </p>
          <small>We usually reply within two business days.</small>
        </aside>
      </section>

      <section className="contact-details" aria-labelledby="contact-details-title">
        <div className="contact-section-heading">
          <span className="eyebrow">Ways to reach us</span>
          <h2 id="contact-details-title">Choose what works for you.</h2>
        </div>
        <div className="contact-card-grid">
          <article>
            <div className="contact-card-heading">
              <span className="contact-card-number">01</span>
              <h3>Send an enquiry</h3>
            </div>
            <p>For orders, products, partnerships, and general enquiries.</p>
            <button className="contact-card-action" type="button" onClick={() => setContactFormOpen(true)}>
              Send us a message
            </button>
          </article>
          <article>
            <div className="contact-card-heading">
              <span className="contact-card-number">02</span>
              <h3>Connect with us</h3>
            </div>
            <p>Call Monday&ndash;Friday, 10:00 AM&ndash;4:00 PM IST, or message us online.</p>
            <div className="contact-channel-links">
              <a href="tel:+918431988910" aria-label="Call us" title="Call">
                <ContactChannelIcon platform="call" />
              </a>
              <a href="https://wa.me/918431988910" target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp" title="WhatsApp">
                <ContactChannelIcon platform="whatsapp" />
              </a>
              <a href="https://www.instagram.com/charaideo.reserves/" target="_blank" rel="noreferrer" aria-label="Follow us on Instagram" title="Instagram">
                <ContactChannelIcon platform="instagram" />
              </a>
              <a href="https://www.facebook.com/profile.php?id=61595061842649" target="_blank" rel="noreferrer" aria-label="Follow us on Facebook" title="Facebook">
                <ContactChannelIcon platform="facebook" />
              </a>
              <a href="https://www.linkedin.com/showcase/charaideo-reserves" target="_blank" rel="noreferrer" aria-label="Follow us on LinkedIn" title="LinkedIn">
                <ContactChannelIcon platform="linkedin" />
              </a>
            </div>
          </article>
          <article>
            <div className="contact-card-heading">
              <span className="contact-card-number">03</span>
              <h3>Visit us</h3>
            </div>
            <p>Ouguri Gaon, Rupai Siding, Assam 786153, India.</p>
            <a className="contact-directions-link" href="https://maps.app.goo.gl/ZTk13bPuNgmt1kBy5" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
                <circle cx="12" cy="9" r="2.4" />
              </svg>
              Get directions <span aria-hidden="true">&#8599;</span>
            </a>
          </article>
        </div>
      </section>

      <dialog
        ref={contactDialogRef}
        className="contact-form-dialog"
        aria-labelledby="contact-form-title"
        onCancel={() => setContactFormOpen(false)}
        onClose={() => setContactFormOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setContactFormOpen(false);
        }}
      >
        {contactFormOpen && (
          <ContactForm
            turnstileSiteKey={turnstileSiteKey}
            onClose={() => setContactFormOpen(false)}
            onSuccess={(message) => {
              setContactFormOpen(false);
              setSuccessMessage(message);
            }}
          />
        )}
      </dialog>

      <dialog
        ref={successDialogRef}
        className="contact-success-dialog"
        aria-labelledby="contact-success-title"
        onCancel={() => setSuccessMessage('')}
        onClose={() => setSuccessMessage('')}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSuccessMessage('');
        }}
      >
        <div className="contact-success-content">
          <span className="contact-success-check" aria-hidden="true">&#10003;</span>
          <div>
            <h2 id="contact-success-title">Message received</h2>
            <p>{successMessage}</p>
          </div>
          <button type="button" onClick={() => setSuccessMessage('')}>Close</button>
        </div>
      </dialog>

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

    </main>
  );
}

function ContactChannelIcon({platform}: {platform: string}) {
  if (platform === 'call') {
    return (
      <svg className="contact-channel-icon contact-channel-icon--call" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.6 3.8 9.2 8l-2 2.1c1.1 2.4 3.1 4.4 5.6 5.6l2.1-2 4.2 2.6-.7 3.3c-.2.9-1 1.5-1.9 1.4C9.4 20.2 3.8 14.6 3 7.5c-.1-.9.5-1.7 1.4-1.9l2.2-.5Z" />
      </svg>
    );
  }
  if (platform === 'whatsapp') {
    return (
      <svg className="contact-channel-icon contact-channel-icon--whatsapp" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L4 20l1.1-4a8.2 8.2 0 1 1 15.1-4.3Z" />
        <path d="M9.1 8.1c.3-.4.6-.4.9 0l1 1.8c.2.4.1.7-.2 1l-.6.6c.8 1.6 1.8 2.6 3.4 3.3l.6-.7c.3-.3.6-.4 1-.2l1.8.9c.4.2.5.6.2.9-.6 1-1.4 1.4-2.5 1.3-3.3-.4-6.9-3.8-7.4-7.1-.2-.8.4-1.4 1.8-1.8Z" />
      </svg>
    );
  }
  if (platform === 'instagram') {
    return (
      <svg className="contact-channel-icon contact-channel-icon--instagram" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="contact-instagram-gradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffdc80" />
            <stop offset="0.28" stopColor="#fcaf45" />
            <stop offset="0.5" stopColor="#f77737" />
            <stop offset="0.72" stopColor="#e1306c" />
            <stop offset="1" stopColor="#833ab4" />
          </linearGradient>
        </defs>
        <rect className="contact-instagram-stroke" x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle className="contact-instagram-stroke" cx="12" cy="12" r="4" />
        <circle className="contact-icon-dot contact-instagram-dot" cx="17.4" cy="6.7" r="1" />
      </svg>
    );
  }
  if (platform === 'facebook') {
    return (
      <svg className="contact-channel-icon contact-channel-icon--facebook" viewBox="0 0 24 24" aria-hidden="true">
        <path className="contact-icon-solid" d="M14.4 8H17V4.4c-.5-.1-1.8-.2-3.5-.2-3.6 0-6 2.2-6 6.2V14H3.5v4h4v3h4.9v-3h4.1l.6-4h-4.7v-3.1c0-1.2.3-2.9 2-2.9Z" />
      </svg>
    );
  }
  return (
    <svg className="contact-channel-icon contact-channel-icon--linkedin" viewBox="0 0 24 24" aria-hidden="true">
      <rect className="contact-icon-solid" x="3" y="9" width="4" height="12" />
      <circle className="contact-icon-solid" cx="5" cy="5" r="2" />
      <path className="contact-icon-solid" d="M10 9h4v1.8c.9-1.4 2.2-2.2 4.1-2.2 3.4 0 3.9 2.5 3.9 5.7V21h-4v-6c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21H10V9Z" />
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
        body: 'Ouguri Gaon, Rupai Siding, Assam 786153, India.',
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
        body: 'Monday–Friday, 10:00 AM–4:00 PM IST.',
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
