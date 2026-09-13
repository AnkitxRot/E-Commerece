import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import { CartProvider } from '../context/CartContext.js';
import { WishlistProvider } from '../context/WishlistContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import { ErrorBoundary } from '../components/ErrorBoundary.js';

export function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Outlet />
              <Toast />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
