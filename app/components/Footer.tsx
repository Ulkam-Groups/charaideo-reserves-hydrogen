import {Brand} from './Brand';
import {NavLink} from 'react-router';
import {POLICY_PAGES} from '~/lib/policies';
import {PaymentLogos} from './PaymentLogos';

export function Footer() {
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
      <nav className="footer-menu" aria-label="Store policies">
        <NavLink prefetch="none" to="/policies">
          All policies
        </NavLink>
        {POLICY_PAGES.map(({handle, title}) => (
          <NavLink key={handle} prefetch="none" to={`/policies/${handle}`}>
            {title}
          </NavLink>
        ))}
      </nav>
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
