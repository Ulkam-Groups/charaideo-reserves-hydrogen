import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import type {Route} from './+types/account';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

export function shouldRevalidate() {
  return true;
}

export async function loader({context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();
  const customerName = customer?.firstName || 'tea lover';

  return (
    <main className="account">
      <header className="account-hero">
        <span className="eyebrow">Your private tea room</span>
        <h1>Welcome, <em>{customerName}.</em></h1>
        <p>Orders, addresses, and the details that make every delivery feel considered.</p>
      </header>
      <div className="account-shell">
        <AccountMenu />
        <section className="account-panel">
          <Outlet context={{customer}} />
        </section>
      </div>
    </main>
  );
}

function AccountMenu() {
  return (
    <aside className="account-sidebar">
      <span className="account-menu-label">Account cabinet</span>
      <nav className="account-menu" aria-label="Customer account">
      <NavLink to="/account/orders" className={accountLinkClass}>
        <span aria-hidden="true">01</span> Orders
      </NavLink>
      <NavLink to="/account/profile" className={accountLinkClass}>
        <span aria-hidden="true">02</span> Profile
      </NavLink>
      <NavLink to="/account/addresses" className={accountLinkClass}>
        <span aria-hidden="true">03</span> Addresses
      </NavLink>
      <Logout />
      </nav>
      <p className="account-sidebar-note">Your account details are kept private and used only to fulfil your tea orders.</p>
    </aside>
  );
}

function accountLinkClass({isActive, isPending}: {isActive: boolean; isPending: boolean}) {
  return `account-menu-link${isActive ? ' is-active' : ''}${isPending ? ' is-pending' : ''}`;
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <button type="submit"><span aria-hidden="true">↗</span> Sign out</button>
    </Form>
  );
}
