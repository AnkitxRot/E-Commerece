import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Breadcrumbs } from '../components/Breadcrumbs.js';

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs items={[{ label: 'Account' }]} />
      <h1 className="text-2xl font-semibold text-ink">Welcome, {user?.name}</h1>
      <p className="text-ink-muted mt-2">{user?.email}</p>
      <div className="mt-8 flex flex-col gap-3">
        <Link to="/account/orders" className="inline-flex min-h-[44px] items-center text-sm text-ink underline">
          Order history
        </Link>
        <Link to="/cart" className="inline-flex min-h-[44px] items-center text-sm text-ink underline">
          Your cart
        </Link>
      </div>
      <p className="text-sm text-ink-muted mt-8">Addresses and account settings arrive in later phases.</p>
    </div>
  );
}
