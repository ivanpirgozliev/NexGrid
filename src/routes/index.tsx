import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthLayout } from './AuthLayout';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { GamePage } from '../features/tetris/pages/GamePage';
import { LeaderboardPage } from '../features/leaderboard/pages/LeaderboardPage';
import { ProfilePage } from '../features/profile/pages/ProfilePage';

export const router = createHashRouter([
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
