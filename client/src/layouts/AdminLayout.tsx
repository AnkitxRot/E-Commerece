import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/brands', label: 'Brands' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/settings', label: 'Settings' },
];

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <aside className="w-full shrink-0 border-b border-border p-4 sm:w-56 sm:border-b-0 sm:border-r">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">Admin</p>
        <nav className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-accent text-white' : 'text-ink-muted hover:bg-surface hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
