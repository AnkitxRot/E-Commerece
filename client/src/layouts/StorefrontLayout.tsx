import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import {
  categoriesResponseSchema,
  storeSettingsDtoSchema,
  type CategoryTreeNode,
} from '@audio-commerce/shared';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function ShopLinks({ categories }: { categories: CategoryTreeNode[] }) {
  return (
    <>
      <Link to="/products" className="inline-flex min-h-[44px] items-center">
        Shop
      </Link>
      {categories.map((category) => (
        <Link key={category.slug} to={`/c/${category.slug}`} className="inline-flex min-h-[44px] items-center">
          {category.name}
        </Link>
      ))}
    </>
  );
}

export function StorefrontLayout() {
  const { user, logout } = useAuth();
  const [storeName, setStoreName] = useState('Aurelia Audio');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [shopNav, setShopNav] = useState<CategoryTreeNode[] | null>(null);

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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <Link to="/" className="font-semibold text-ink">
          {logoUrl ? <img src={logoUrl} alt={storeName} className="h-8" /> : storeName}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {shopNav ? (
            <>
              <div className="hidden items-center gap-4 md:flex">
                <ShopLinks categories={shopNav} />
              </div>
              <details className="md:hidden">
                <summary className="flex min-h-[44px] cursor-pointer items-center">Shop</summary>
                <div className="flex flex-col gap-2 py-2">
                  <ShopLinks categories={shopNav} />
                </div>
              </details>
            </>
          ) : null}
          {user ? (
            <>
              <Link to="/account">Account</Link>
              <button type="button" onClick={() => logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
