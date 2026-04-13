import { useState, type FormEvent } from 'react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

interface LoginFormProps {
  onSwitch: () => void;
}

export function LoginForm({ onSwitch }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading, error } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await signIn({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="login-email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        id="login-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" isLoading={isLoading} className="mt-1 w-full">
        Sign In
      </Button>
      <p className="text-center text-sm text-gray-500">
        No account?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Create one
        </button>
      </p>
    </form>
  );
}
