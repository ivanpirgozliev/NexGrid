import { useMemo, useState, type FormEvent } from 'react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { checkPasswordStrength, validateUsername } from '../../../utils/validation';

interface RegisterFormProps {
  onSwitch: () => void;
}

const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-green-500'];

export function RegisterForm({ onSwitch }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { signUp, isLoading, error, info, setError } = useAuth();

  const passwordStrength = useMemo(() => checkPasswordStrength(password), [password]);
  const usernameError = useMemo(() => (username.length > 0 ? validateUsername(username) : null), [username]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const uErr = validateUsername(username);
    if (uErr) {
      setError(uErr);
      return;
    }
    if (!passwordStrength.isValid) {
      setError(passwordStrength.feedback);
      return;
    }

    await signUp({ email, password, username });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Input
          id="reg-username"
          label="Username"
          type="text"
          placeholder="BlockMaster99"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={24}
          pattern="[a-zA-Z0-9_]+"
        />
        {usernameError && (
          <p className="text-xs text-amber-400 mt-1">{usernameError}</p>
        )}
      </div>
      <Input
        id="reg-email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div>
        <Input
          id="reg-password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {password.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < passwordStrength.score ? strengthColors[passwordStrength.score - 1] : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{passwordStrength.feedback}</p>
          </div>
        )}
      </div>
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
