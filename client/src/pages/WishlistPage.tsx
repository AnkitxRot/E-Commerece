import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { Button } from '../components/Button.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { ProductGrid } from '../components/catalog/ProductGrid.js';

export default function WishlistPage() {
  const { wishlist, loading, error, refresh } = useWishlist();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Shop', href: '/products' }, { label: 'Wishlist' }]} />
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Your wishlist</h1>

      {error && !wishlist ? (
        <ErrorState title="Unable to load your wishlist" description={error.message} onRetry={() => void refresh()} />
      ) : loading && !wishlist ? (
        <div aria-busy="true">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !wishlist || wishlist.items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Save products you love and they'll show up here."
          action={
            <Link to="/products">
              <Button type="button">Continue shopping</Button>
            </Link>
          }
        />
      ) : (
        <ProductGrid products={wishlist.items.map((item) => item.product)} id="wishlist-grid" />
      )}
    </div>
  );
}
