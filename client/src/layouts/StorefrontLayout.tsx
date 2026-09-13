import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import {
  categoriesResponseSchema,
  storeSettingsDtoSchema,
  type CategoryTreeNode,
} from '@audio-commerce/shared';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Footer } from './Footer.js';

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function SearchForm({ id, onNavigate }: { id: string; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = q.trim();
    navigate(query ? `/products?q=${encodeURIComponent(query)}` : '/products');
    onNavigate?.();
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <input
        id={id}
        type="search"
        placeholder="Search products"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <button
        type="submit"
        className="flex h-10 min-w-[44px] items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-ink duration-snap"
      >
        Search
      </button>
    </form>
  );
}

function CartLink({ onNavigate }: { onNavigate?: () => void }) {
  const { cart } = useCart();
  const count = cart?.itemCount ?? 0;
  return (
    <Link
      to="/cart"
      onClick={onNavigate}
      className="relative inline-flex min-h-[44px] items-center gap-1.5 text-ink"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M3 4h2l2.4 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
      </svg>
      <span className="hidden text-sm sm:inline">Cart</span>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-medium text-accent-ink"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function AccountLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (user) {
    return (
      <>
        <Link to="/account" onClick={onNavigate} className="inline-flex min-h-[44px] items-center text-sm">
          Account
        </Link>
        <button
          type="button"
          onClick={() => {
            void logout();
            onNavigate?.();
          }}
          className="inline-flex min-h-[44px] items-center text-sm"
        >
          Log out
        </button>
      </>
    );
  }
  return (
    <>
      <Link to="/login" onClick={onNavigate} className="inline-flex min-h-[44px] items-center text-sm">
        Log in
      </Link>
      <Link to="/register" onClick={onNavigate} className="inline-flex min-h-[44px] items-center text-sm">
        Create account
      </Link>
    </>
  );
}

function ShopLinks({ categories, onNavigate }: { categories: CategoryTreeNode[]; onNavigate?: () => void }) {
  return (
    <>
      <Link to="/products" onClick={onNavigate} className="inline-flex min-h-[44px] items-center">
        Shop
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          to={`/c/${category.slug}`}
          onClick={onNavigate}
          className="inline-flex min-h-[44px] items-center"
        >
          {category.name}
        </Link>
      ))}
    </>
  );
}

export function StorefrontLayout() {
  const [storeName, setStoreName] = useState('Everyday');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [shopNav, setShopNav] = useState<CategoryTreeNode[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      const [settingsResult, categoriesResult] = await Promise.allSettled([
        apiFetch('/api/catalog/settings', { signal: ac.signal }).then((data) =>
          parseCatalog(storeSettingsDtoSchema, data),
        ),
        apiFetch('/api/catalog/categories', { signal: ac.signal }).then((data) =>
          parseCatalog(categoriesResponseSchema, data),
        ),
      ]);
      if (cancelled || ac.signal.aborted) return;
      if (settingsResult.status === 'rejected' && isAbort(settingsResult.reason)) return;
      if (categoriesResult.status === 'rejected' && isAbort(categoriesResult.reason)) return;
      if (settingsResult.status === 'fulfilled') {
        setStoreName(settingsResult.value.storeName);
        setLogoUrl(settingsResult.value.logoUrl);
      }
      if (categoriesResult.status === 'fulfilled') {
        setShopNav(categoriesResult.value.categories);
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-glass-border bg-glass backdrop-blur-glass">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <Link to="/" className="font-semibold text-ink">
              {logoUrl ? <img src={logoUrl} alt={storeName} className="h-8" /> : storeName}
            </Link>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <SearchForm id="search-desktop" />
          </div>

          <nav className="flex items-center gap-4 text-sm">
            {shopNav ? (
              <div className="hidden items-center gap-4 lg:flex">
                <ShopLinks categories={shopNav} />
              </div>
            ) : null}
            <div className="hidden items-center gap-4 md:flex">
              <AccountLinks />
            </div>
            <CartLink />
          </nav>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={closeDrawer}
          />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col gap-6 overflow-y-auto border-r border-glass-border bg-glass-strong p-6 backdrop-blur-glass">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{storeName}</span>
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
                onClick={closeDrawer}
              >
                ✕
              </button>
            </div>
            <SearchForm id="search-mobile" onNavigate={closeDrawer} />
            <nav className="flex flex-col gap-3 text-base" aria-label="Shop">
              {shopNav ? <ShopLinks categories={shopNav} onNavigate={closeDrawer} /> : null}
            </nav>
            <nav className="flex flex-col gap-3 border-t border-border pt-4 text-base" aria-label="Account">
              <AccountLinks onNavigate={closeDrawer} />
            </nav>
          </div>
        </div>
      ) : null}

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
