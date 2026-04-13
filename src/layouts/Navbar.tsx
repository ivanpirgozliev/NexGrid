import { NavLink, useNavigate } from 'react-router-dom';
import { Gamepad2, Trophy, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthContext } from '../features/auth/context/AuthContext';
import { authService } from '../services/auth.service';

const navLinks = [
  { to: '/game', label: 'Play', icon: Gamepad2 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export function Navbar() {
  const { username } = useAuthContext();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authService.signOut();
    navigate('/auth');
  }

  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-50 h-16 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl"
    >
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
        <NavLink to="/game" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
            <Gamepad2 className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-white font-bold tracking-tight text-sm">TETRIS</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {username && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-300 text-sm font-medium">{username}</span>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
