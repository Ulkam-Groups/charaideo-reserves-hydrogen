import {Brand} from './Brand';
import {useAnalytics} from '@shopify/hydrogen';
import {NavLink, useLocation} from 'react-router';
import {POLICY_PAGES} from '~/lib/policies';
import {PaymentLogos} from './PaymentLogos';
import {CountryIndicator, countryDisplayName} from './Header';
import type {StorefrontMarket} from '~/lib/markets';
import {useState} from 'react';
import {PreferredSourceButton} from './PreferredSourceButton';

export function Footer({
  buyerCountry,
  availableMarkets,
}: {
  buyerCountry: string;
  availableMarkets: StorefrontMarket[];
}) {
  const {privacyBanner} = useAnalytics();

  return (
    <footer className="footer site-footer">
      <div className="footer-accent" aria-hidden="true" />
      <div className="footer-inner">
        <section className="footer-brand">
          <Brand />
          <p>A place. A people. A pot of tea. Bringing Assam back to the table.</p>
        </section>
        <FooterColumn
          title="Explore"
          links={[
            {label: 'Reserve List', to: '/reserve-list'},
            {label: 'Shop all teas', to: '/collections/all'},
            {label: 'About Us', to: '/pages/about-us'},
            {label: 'Contact', to: '/pages/contact'},
          ]}
        />
        <FooterColumn
          title="Your visit"
          links={[
            {label: 'Account', to: '/sign-in'},
            {label: 'Cart', to: '/cart'},
          ]}
        />
        <section className="footer-contact">
          <h3>Contact</h3>
          <p>Ouguri Gaon, Rupai Siding, Assam 786153, India</p>
          <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a>
          <a href="tel:+918431988910">+91 84319 88910</a>
        </section>
      </div>
      <div className="footer-preferences">
        <MarketSelector
          availableMarkets={availableMarkets}
          buyerCountry={buyerCountry}
          className="footer-location"
          id="footer-market"
        />
        <div className="footer-preferred-source">
          <PreferredSourceButton theme="light" />
        </div>
      </div>
      <nav className="footer-menu footer-menu-desktop" aria-label="Store policies">
        <NavLink prefetch="none" to="/policies">
          All policies
        </NavLink>
        {POLICY_PAGES.map(({handle, title}) => (
          <NavLink key={handle} prefetch="none" to={`/policies/${handle}`}>
            {title}
          </NavLink>
        ))}
        <button
          className="footer-privacy-choices reset"
          onClick={() => privacyBanner?.showPreferences()}
          type="button"
        >
          Privacy choices
        </button>
      </nav>
      <details className="footer-policies-mobile">
        <summary>Store policies</summary>
        <nav aria-label="Store policies">
          <NavLink prefetch="none" to="/policies">
            All policies
          </NavLink>
          {POLICY_PAGES.map(({handle, title}) => (
            <NavLink key={handle} prefetch="none" to={`/policies/${handle}`}>
              {title}
            </NavLink>
          ))}
          <button
            className="footer-privacy-choices reset"
            onClick={() => privacyBanner?.showPreferences()}
            type="button"
          >
            Privacy choices
          </button>
        </nav>
      </details>
      <div className="footer-bottom">
        <p>© 2026 Ulkam Group. All rights reserved.</p>
        <div className="footer-secure">
          <strong>Secure checkout</strong>
          <PaymentLogos />
        </div>
        <p>Made with love in Assam.</p>
      </div>
    </footer>
  );
}

export function MarketSelector({
  availableMarkets,
  buyerCountry,
  className,
  id,
}: {
  availableMarkets: StorefrontMarket[];
  buyerCountry: string;
  className: string;
  id: string;
}) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const markets = availableMarkets.length
    ? availableMarkets
    : [
        {
          isoCode: buyerCountry,
          name: countryDisplayName(buyerCountry),
          currency: {isoCode: '', symbol: ''},
        },
      ];
  const current =
    markets.find((market) => market.isoCode === buyerCountry) ?? markets[0];
  const filteredMarkets = markets.filter((market) =>
    `${market.name} ${market.isoCode}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <form className={className} action="/api/market" method="post">
      <input
        name="redirectTo"
        type="hidden"
        value={`${location.pathname}${location.search}${location.hash}`}
      />
      <span className="market-picker-eyebrow">Shopping from</span>
      <details className="market-picker">
        <summary aria-label="Change shopping country">
          <CountryIndicator countryCode={current.isoCode} />
          <span>{current.name}</span>
          {current.currency.isoCode && (
            <small>
              {current.currency.isoCode} {current.currency.symbol}
            </small>
          )}
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </summary>
        <div className="market-picker-popover">
          <label htmlFor={id}>Choose your location</label>
          <input
            autoComplete="off"
            id={id}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search countries"
            type="search"
            value={query}
          />
          <div className="market-picker-options">
            {filteredMarkets.map((market) => (
              <button
                aria-current={market.isoCode === buyerCountry ? 'true' : undefined}
                key={market.isoCode}
                name="country"
                type="submit"
                value={market.isoCode}
              >
                <CountryIndicator countryCode={market.isoCode} />
                <span>{market.name}</span>
                {market.currency.isoCode && (
                  <small>
                    {market.currency.isoCode} {market.currency.symbol}
                  </small>
                )}
              </button>
            ))}
          </div>
        </div>
      </details>
    </form>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: {label: string; to: string}[];
}) {
  return (
    <section className="footer-column">
      <h3>{title}</h3>
      {links.map((link) => (
        <NavLink
          key={link.to}
          prefetch="none"
          to={link.to}
        >
          {link.label}
        </NavLink>
      ))}
    </section>
  );
}
