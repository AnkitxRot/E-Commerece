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
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage.js'));
const AdminProductFormPage = lazy(() => import('./pages/AdminProductFormPage.js'));
const AdminCategoriesPage = lazy(() => import('./pages/AdminCategoriesPage.js'));
const AdminBrandsPage = lazy(() => import('./pages/AdminBrandsPage.js'));
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage.js'));
const AdminOrderDetailPage = lazy(() => import('./pages/AdminOrderDetailPage.js'));
const AdminReviewsPage = lazy(() => import('./pages/AdminReviewsPage.js'));
const AdminCouponsPage = lazy(() => import('./pages/AdminCouponsPage.js'));
const ProductListPage = lazy(() => import('./pages/ProductListPage.js'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage.js'));
const HomePage = lazy(() => import('./pages/HomePage.js'));
const CartPage = lazy(() => import('./pages/CartPage.js'));
const WishlistPage = lazy(() => import('./pages/WishlistPage.js'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.js'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage.js'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage.js'));
const ImageCreditsPage = lazy(() => import('./pages/ImageCreditsPage.js'));

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route element={<StorefrontLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="c/:categorySlug" element={<ProductListPage />} />
            <Route path="p/:productSlug" element={<ProductDetailPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="credits" element={<ImageCreditsPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="account" element={<AccountPage />} />
              <Route path="account/orders" element={<OrderHistoryPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="orders/:orderId" element={<OrderDetailPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute role={Role.ADMIN} />}>
            <Route element={<AdminLayout />}>
              <Route path="admin" element={<AdminOverviewPage />} />
              <Route path="admin/products" element={<AdminProductsPage />} />
              <Route path="admin/products/new" element={<AdminProductFormPage />} />
              <Route path="admin/products/:id" element={<AdminProductFormPage />} />
              <Route path="admin/categories" element={<AdminCategoriesPage />} />
              <Route path="admin/brands" element={<AdminBrandsPage />} />
              <Route path="admin/orders" element={<AdminOrdersPage />} />
              <Route path="admin/orders/:id" element={<AdminOrderDetailPage />} />
              <Route path="admin/reviews" element={<AdminReviewsPage />} />
              <Route path="admin/coupons" element={<AdminCouponsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
