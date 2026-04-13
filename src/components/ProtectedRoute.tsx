import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../features/auth/context/AuthContext';

export function ProtectedRoute() {
  const { session, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
