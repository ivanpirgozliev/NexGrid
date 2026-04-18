import { NavLink, useNavigate } from 'react-router-dom';
import { Gamepad2, Trophy, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { authService } from '../services/auth.service';

const navLinks = [
  { to: '/game', label: 'Play', icon: Gamepad2 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/profile', label: 'Profile', icon: User },
];

export function Navbar() {
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
      className="sticky top-0 z-50 h-12 sm:h-16 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto h-full px-3 sm:px-4 lg:max-w-[840px] flex items-center justify-between gap-2">
        <NavLink to="/game" className="flex items-center gap-1.5 sm:gap-2.5 group shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
            <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          </div>
          <span className="hidden sm:inline text-white font-bold tracking-tight text-sm">TETRIS</span>
        </NavLink>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
