import {Brand} from './Brand';
import {NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer,
  header,
  publicStoreDomain,
}: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-accent" aria-hidden="true" />
      <div className="footer-inner">
        <section className="footer-brand">
          <Brand variant="light" />
          <p>
            A place. A people. A pot of tea.
            Bringing Assam back to the table.
          </p>
        </section>
        <FooterColumn
          title="Company"
          links={[
            {label: 'About Us', to: '/pages/about-us'},
            {label: 'Catalog', to: '/collections/all'},
            {label: 'Contact', to: '/pages/contact'},
          ]}
        />
        <FooterColumn
          title="Products"
          links={[
            {label: 'Orthodox Black Tea', to: '/collections/all'},
            {label: 'Green Tea', to: '/collections/all'},
            {label: 'Single Grade CTC', to: '/collections/all'},
            {label: 'Speciality Tea', to: '/collections/all'},
          ]}
        />
        <section className="footer-contact">
          <h3>Contact</h3>
          <p>Ownguri Gaon, Rupai Siding, Assam 786153, India</p>
          <a href="mailto:contact@ulkamgroup.com">contact@ulkamgroup.com</a>
          <a href="tel:+918431988910">+91 84319 88910</a>
        </section>
      </div>
      {header.shop.primaryDomain?.url && (
        <FooterMenu
          menu={null}
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Ulkam Group. All rights reserved.</p>
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
        <NavLink key={link.to + link.label} prefetch="intent" to={link.to}>
          {link.label}
        </NavLink>
      ))}
    </section>
  );
}

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery['menu'];
  primaryDomainUrl: FooterProps['header']['shop']['primaryDomain']['url'];
  publicStoreDomain: string;
}) {
  return (
    <nav className="footer-menu" role="navigation" aria-label="Policies">
      {(menu || FALLBACK_FOOTER_MENU).items.map((item) => {
        if (!item.url) return null;
        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith('/');
        return isExternal ? (
          <a href={url} key={item.id} rel="noopener noreferrer" target="_blank">
            {item.title}
          </a>
        ) : (
          <NavLink
            end
            key={item.id}
            prefetch="intent"
            to={url}
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

const FALLBACK_FOOTER_MENU = {
  id: 'gid://shopify/Menu/199655620664',
  items: [
    {
      id: 'gid://shopify/MenuItem/461633060920',
      resourceId: 'gid://shopify/ShopPolicy/23358046264',
      tags: [],
      title: 'Privacy Policy',
      type: 'SHOP_POLICY',
      url: '/policies/privacy-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633093688',
      resourceId: 'gid://shopify/ShopPolicy/23358013496',
      tags: [],
      title: 'Refund Policy',
      type: 'SHOP_POLICY',
      url: '/policies/refund-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633126456',
      resourceId: 'gid://shopify/ShopPolicy/23358111800',
      tags: [],
      title: 'Shipping Policy',
      type: 'SHOP_POLICY',
      url: '/policies/shipping-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633159224',
      resourceId: 'gid://shopify/ShopPolicy/23358079032',
      tags: [],
      title: 'Terms of Service',
      type: 'SHOP_POLICY',
      url: '/policies/terms-of-service',
      items: [],
    },
  ],
};
