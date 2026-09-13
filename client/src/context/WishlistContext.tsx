import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { wishlistDtoSchema, type WishlistDto } from '@audio-commerce/shared';
import { useAuth } from './AuthContext.js';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';

interface WishlistContextValue {
  wishlist: WishlistDto | null;
  loading: boolean;
  error: Error | null;
  isWishlisted: (slug: string) => boolean;
  addProduct: (slug: string) => Promise<void>;
  removeProduct: (slug: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const EMPTY_WISHLIST: WishlistDto = { items: [] };

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setWishlist(EMPTY_WISHLIST);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const data = parseCatalog(wishlistDtoSchema, await apiFetch('/api/wishlist'));
      setWishlist(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unable to load your wishlist'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addProduct = useCallback(async (slug: string) => {
    const data = parseCatalog(
      wishlistDtoSchema,
      await apiFetch('/api/wishlist/items', { method: 'POST', body: JSON.stringify({ slug }) }),
    );
    setWishlist(data);
  }, []);

  const removeProduct = useCallback(async (slug: string) => {
    const data = parseCatalog(wishlistDtoSchema, await apiFetch(`/api/wishlist/items/${slug}`, { method: 'DELETE' }));
    setWishlist(data);
  }, []);

  const slugs = useMemo(() => new Set((wishlist?.items ?? []).map((item) => item.product.slug)), [wishlist]);
  const isWishlisted = useCallback((slug: string) => slugs.has(slug), [slugs]);

  return (
    <WishlistContext.Provider value={{ wishlist, loading, error, isWishlisted, addProduct, removeProduct, refresh }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
