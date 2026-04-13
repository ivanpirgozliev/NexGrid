import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { GamePage } from '../features/tetris/pages/GamePage';
import { LeaderboardPage } from '../features/leaderboard/pages/LeaderboardPage';

function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/auth',
        element: <AuthPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: '/game',
                element: <GamePage />,
              },
              {
                path: '/leaderboard',
                element: <LeaderboardPage />,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/game" replace />,
      },
    ],
  },
]);
