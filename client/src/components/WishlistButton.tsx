import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useWishlist } from '../context/WishlistContext.js';
import { useToast } from '../context/ToastContext.js';
import { ApiError } from '../lib/apiClient.js';

export function WishlistButton({ slug, className }: { slug: string; className?: string }) {
  const { user } = useAuth();
  const { isWishlisted, addProduct, removeProduct } = useWishlist();
  const { show } = useToast();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const wishlisted = isWishlisted(slug);

  async function handleClick() {
    if (!user) {
      navigate('/login');
      return;
    }
    setPending(true);
    try {
      if (wishlisted) {
        await removeProduct(slug);
      } else {
        await addProduct(slug);
        show('Added to your wishlist', 'success');
      }
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update your wishlist', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={wishlisted}
      aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-busy={pending}
      disabled={pending}
      onClick={() => void handleClick()}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-ink transition-transform duration-snap ease-standard active:scale-[0.92] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={wishlisted ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <path
          d="M12 20.5s-7.5-4.6-10-9.2C.5 8 2 4.5 5.5 4c2-.3 3.8.7 4.9 2.2L12 8l1.6-1.8c1.1-1.5 2.9-2.5 4.9-2.2 3.5.5 5 4 3.5 7.3-2.5 4.6-10 9.2-10 9.2z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
