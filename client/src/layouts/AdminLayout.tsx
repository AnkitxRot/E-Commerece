import { Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border p-4">
        <p className="font-semibold text-ink">Admin</p>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
