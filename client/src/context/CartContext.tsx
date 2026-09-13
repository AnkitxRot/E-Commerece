import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cartDtoSchema, type CartDto } from '@audio-commerce/shared';
import { useAuth } from './AuthContext.js';
import { apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';

interface CartContextValue {
  cart: CartDto | null;
  loading: boolean;
  error: Error | null;
  addItem: (variantId: string, qty: number) => Promise<void>;
  updateItemQty: (itemId: string, qty: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: CartDto = { items: [], itemCount: 0, subtotal: '0.00' };

export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setCart(EMPTY_CART);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const data = parseCatalog(cartDtoSchema, await apiFetch('/api/cart'));
      setCart(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unable to load your cart'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(async (variantId: string, qty: number) => {
    const data = parseCatalog(
      cartDtoSchema,
      await apiFetch('/api/cart/items', { method: 'POST', body: JSON.stringify({ variantId, qty }) }),
    );
    setCart(data);
  }, []);

  const updateItemQty = useCallback(async (itemId: string, qty: number) => {
    const data = parseCatalog(
      cartDtoSchema,
      await apiFetch(`/api/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ qty }) }),
    );
    setCart(data);
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const data = parseCatalog(cartDtoSchema, await apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE' }));
    setCart(data);
  }, []);

  const clearCart = useCallback(async () => {
    const data = parseCatalog(cartDtoSchema, await apiFetch('/api/cart', { method: 'DELETE' }));
    setCart(data);
  }, []);

  return (
    <CartContext.Provider value={{ cart, loading, error, addItem, updateItemQty, removeItem, clearCart, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
