import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider } from '../features/auth/context/AuthContext';

export function AuthLayout() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  );
}
