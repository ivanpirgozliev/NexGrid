import { lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthLayout } from './AuthLayout';

const AuthPage = lazy(() => import('../features/auth/pages/AuthPage').then(m => ({ default: m.AuthPage })));
const GamePage = lazy(() => import('../features/tetris/pages/GamePage').then(m => ({ default: m.GamePage })));
const LeaderboardPage = lazy(() => import('../features/leaderboard/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('../features/profile/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));

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
