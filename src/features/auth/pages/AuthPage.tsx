import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from '../components/RegisterForm';
import { useAuthContext } from '../context/AuthContext';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { session, isLoading } = useAuthContext();

  if (!isLoading && session) return <Navigate to="/game" replace />;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/30 via-gray-950 to-gray-950 pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <Gamepad2 className="w-7 h-7 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">NexGrid</h1>
            <p className="text-gray-500 text-sm mt-1">
              {mode === 'login' ? 'Welcome back, player' : 'Join the competition'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 16 : -16 }}
              transition={{ duration: 0.2 }}
            >
              {mode === 'login' ? (
                <LoginForm onSwitch={() => setMode('register')} />
              ) : (
                <RegisterForm onSwitch={() => setMode('login')} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
