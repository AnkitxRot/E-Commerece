import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Role } from '@audio-commerce/shared';
import { RootLayout } from './layouts/RootLayout.js';
import { StorefrontLayout } from './layouts/StorefrontLayout.js';
import { AdminLayout } from './layouts/AdminLayout.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LoadingState } from './components/LoadingState.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.js'));
const AccountPage = lazy(() => import('./pages/AccountPage.js'));
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage.js'));
const ProductListPage = lazy(() => import('./pages/ProductListPage.js'));

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route element={<StorefrontLayout />}>
            <Route index element={<div className="p-6">Home — Phase 2 builds this</div>} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="c/:categorySlug" element={<ProductListPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute role={Role.ADMIN} />}>
            <Route element={<AdminLayout />}>
              <Route path="admin" element={<AdminOverviewPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
