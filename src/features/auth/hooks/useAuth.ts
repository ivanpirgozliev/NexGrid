import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, type AuthCredentials } from '../../../services/auth.service';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  async function signIn(credentials: AuthCredentials) {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      await authService.signIn(credentials);
      navigate('/game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(credentials: AuthCredentials) {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await authService.signUp(credentials);
      if (data.session) {
        navigate('/game');
      } else {
        setInfo('Account created! Check your email to confirm, then sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    setIsLoading(true);
    try {
      await authService.signOut();
      navigate('/auth');
    } finally {
      setIsLoading(false);
    }
  }

  return { signIn, signUp, signOut, isLoading, error, info, setError };
}
