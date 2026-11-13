import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';

const OFFER_STORAGE_KEY = 'charaideo:first-visit-discovery-offer:v1';
const DISCOVERY_SET_URL = '/products/chapter-one-the-discovery-set?Title=Default+Title';

export function FirstVisitOfferBanner() {
  const [visible, setVisible] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(OFFER_STORAGE_KEY)) return;
      window.localStorage.setItem(OFFER_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Storage can be unavailable in strict privacy modes. The offer can still
      // be shown for the current page load.
    }

    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="first-visit-offer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setVisible(false);
      }}
    >
      <aside
        className="first-visit-offer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-visit-offer-title"
        aria-describedby="first-visit-offer-description"
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="first-visit-offer-close"
          aria-label="Close Discovery Set offer"
          onClick={() => setVisible(false)}
        >
          &times;
        </button>

        <div className="first-visit-offer-image">
          <picture>
            <source
              media="(max-width: 680px)"
              srcSet="/images/discovery-set-offer-mobile.png"
            />
            <img
              src="/images/discovery-set-offer-mobile.png"
              alt="Charaideo Reserves Discovery Set with five distinctive teas"
            />
          </picture>
        </div>

        <div className="first-visit-offer-copy">
          <div className="first-visit-offer-product">
            <span className="first-visit-offer-eyebrow">
              New release · Available to order
            </span>
            <h2 id="first-visit-offer-title">The Discovery Set</h2>
            <p id="first-visit-offer-description">
              A curated tasting of five distinctive teas from Charaideo Reserves.
            </p>
            <Link
              to={DISCOVERY_SET_URL}
              prefetch="none"
              className="first-visit-offer-action"
              onClick={() => setVisible(false)}
            >
              Discover the set
            </Link>
          </div>
          <div className="first-visit-offer-discount">
            <span>Storewide offer</span>
            <strong>10% off orders above ₹1,099</strong>
            <small>Available across the store on qualifying orders.</small>
          </div>
        </div>
      </aside>
    </div>
  );
}
