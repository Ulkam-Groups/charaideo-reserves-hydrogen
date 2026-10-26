import {startTransition, useEffect, useState} from 'react';

const NAV_SECTIONS = [
  ['tea-character-section', 'Taste'],
  ['tea-journey-section', 'Our Tea Journey'],
  ['tea-record-section', 'Product information'],
  ['tea-recipe-section', 'How to brew'],
  ['tea-fit-section', 'Good for you?'],
  ['tea-why-section', 'Why we chose it'],
  ['customer-notes', 'Reviews'],
] as const;

/** Fades sections in and animates meters once, respecting reduced motion. */
export function useScrollReveal() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const targets = document.querySelectorAll<HTMLElement>(
      '.tea-section, .product-reviews, .product-related',
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      {rootMargin: '0px 0px -12% 0px', threshold: 0.08},
    );

    targets.forEach((target) => {
      target.setAttribute('data-reveal', '');
      observer.observe(target);
    });

    return () => {
      observer.disconnect();
      targets.forEach((target) => {
        target.removeAttribute('data-reveal');
        target.classList.remove('is-visible');
      });
    };
  }, []);
}

/** Sticky in-page navigation with scroll-spy so the long page feels like an app. */
export function ProductSectionNav() {
  const [items, setItems] = useState<Array<readonly [string, string]>>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const present = NAV_SECTIONS.filter(([id]) => document.getElementById(id));
    startTransition(() => setItems(present));
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          startTransition(() => setActiveId(visible.target.id));
        }
      },
      {rootMargin: '-30% 0px -60% 0px'},
    );
    present.forEach(([id]) => observer.observe(document.getElementById(id)!));
    return () => observer.disconnect();
  }, []);

  if (items.length < 2) return <div className="product-section-nav-slot" />;

  return (
    <nav className="product-section-nav" aria-label="Product sections">
      <div>
        {items.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeId === id ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(id)?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'auto'
                  : 'smooth',
                block: 'start',
              });
              history.replaceState(null, '', `#${id}`);
            }}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function TrustIcon({name}: {name: 'leaf' | 'lock' | 'clock' | 'badge'}) {
  const paths = {
    leaf: 'M5 19c0-9 5-14 14-14 0 9-5 14-14 14zm0 0c2-4 5-7 9-9',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    badge: 'M12 3l2.5 2 3.2-.3.9 3.1 2.6 1.9-1.2 3 1.2 3-2.6 1.9-.9 3.1-3.2-.3L12 21l-2.5-2-3.2.3-.9-3.1L2.8 14.3 4 11.3l-1.2-3 2.6-1.9.9-3.1 3.2.3zM9 12l2 2 4-4',
  };
  return (
    <svg
      className="trust-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
