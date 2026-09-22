import {Brand} from './Brand';
import {NavLink} from 'react-router';
import {POLICY_PAGES} from '~/lib/policies';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-accent" aria-hidden="true" />
      <div className="footer-inner">
        <section className="footer-brand">
          <Brand variant="light" />
          <p>One estate, one harvest, fully traceable. No blends.</p>
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
            {label: 'Search', to: '/search'},
            {label: 'Cart', to: '/cart'},
          ]}
        />
        <section className="footer-contact">
          <h3>Contact</h3>
          <p>Ownguri Gaon, Rupai Siding, Assam 786153, India</p>
          <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a>
          <a href="tel:+918431988910">+91 84319 88910</a>
        </section>
      </div>
      <nav className="footer-menu" aria-label="Store policies">
        <NavLink prefetch="intent" to="/policies">
          All policies
        </NavLink>
        {POLICY_PAGES.map(({handle, title}) => (
          <NavLink key={handle} prefetch="intent" to={`/policies/${handle}`}>
            {title}
          </NavLink>
        ))}
      </nav>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Charaideo Reserves. All rights reserved.</p>
        <p>Rooted in Assam.</p>
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
        <NavLink key={link.to} prefetch="intent" to={link.to}>
          {link.label}
        </NavLink>
      ))}
    </section>
  );
}
