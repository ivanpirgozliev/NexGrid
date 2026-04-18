import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { GamePage } from '../features/tetris/pages/GamePage';
import { LeaderboardPage } from '../features/leaderboard/pages/LeaderboardPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';

function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/game" replace />,
      },
      {
        path: 'auth',
        element: <AuthPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: 'game',
                element: <GamePage />,
              },
              {
                path: 'leaderboard',
                element: <LeaderboardPage />,
              },
              {
                path: 'profile',
                element: <ProfilePage />,
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
