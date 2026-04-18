import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../features/auth/context/AuthContext';

export function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
