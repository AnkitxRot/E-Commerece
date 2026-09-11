import { useAuth } from '../context/AuthContext.js';

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink">Welcome, {user?.name}</h1>
      <p className="text-ink-muted mt-2">{user?.email}</p>
      <p className="text-sm text-ink-muted mt-8">
        Order history, addresses, and account settings arrive in later phases.
      </p>
    </div>
  );
}
