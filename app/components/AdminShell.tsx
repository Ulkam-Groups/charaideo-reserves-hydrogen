import {Link} from 'react-router';

export function AdminShell({children}: {children: React.ReactNode}) {
  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <Link className="admin-brand" prefetch="intent" to="/admin">
          <span className="admin-brand-mark" aria-hidden="true">
            CR
          </span>
          <span>
            <strong>Charaideo Reserves</strong>
            <small>Product Studio</small>
          </span>
        </Link>
        <nav aria-label="Admin navigation">
          <Link prefetch="intent" to="/admin">
            Products
          </Link>
          <a href="/" target="_blank" rel="noreferrer">
            View store
          </a>
        </nav>
      </header>
      <main className="admin-main" id="admin-main">
        {children}
      </main>
    </div>
  );
}

export function AdminAlert({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'critical';
}) {
  return (
    <div
      className={`admin-alert admin-alert--${tone}`}
      role={tone === 'critical' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
