import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { Toast } from '../components/Toast.js';
import { ErrorBoundary } from '../components/ErrorBoundary.js';

export function RootLayout() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Outlet />
          <Toast />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
