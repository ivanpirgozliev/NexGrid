import { lazy } from 'react';

/*
  The lazily-loaded route components live apart from the router definition so
  that each file has a single kind of export: components here, the router next
  door. Mixing the two breaks Fast Refresh, which can only hot-swap a module
  when everything it exports is a component.
*/

export const AuthPage = lazy(() =>
  import('../features/auth/pages/AuthPage').then((m) => ({ default: m.AuthPage }))
);

export const GamePage = lazy(() =>
  import('../features/tetris/pages/GamePage').then((m) => ({ default: m.GamePage }))
);

export const LeaderboardPage = lazy(() =>
  import('../features/leaderboard/pages/LeaderboardPage').then((m) => ({
    default: m.LeaderboardPage,
  }))
);

export const ProfilePage = lazy(() =>
  import('../features/profile/pages/ProfilePage').then((m) => ({
    default: m.ProfilePage,
  }))
);
