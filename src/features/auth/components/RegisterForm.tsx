import { useState, type FormEvent } from 'react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

interface RegisterFormProps {
  onSwitch: () => void;
}

export function RegisterForm({ onSwitch }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { signUp, isLoading, error, info } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await signUp({ email, password, username });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="reg-username"
        label="Username"
        type="text"
        placeholder="BlockMaster99"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        minLength={3}
      />
      <Input
        id="reg-email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        id="reg-password"
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />
      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-cyan-300 bg-cyan-950/40 border border-cyan-900 rounded-lg px-3 py-2">
          {info}
        </p>
      )}
      <Button type="submit" size="lg" isLoading={isLoading} className="mt-1 w-full">
        Create Account
      </Button>
      <p className="text-center text-sm text-gray-500">
        Already have one?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
