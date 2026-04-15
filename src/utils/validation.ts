export interface PasswordStrength {
  score: number;
  feedback: string;
  isValid: boolean;
}

export function checkPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8)
    return { score: 0, feedback: 'Must be at least 8 characters', isValid: false };

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const feedback =
    score <= 1
      ? 'Weak - add uppercase, numbers, or symbols'
      : score <= 2
        ? 'Fair - consider adding more variety'
        : score <= 3
          ? 'Good'
          : 'Strong';

  return { score, feedback, isValid: score >= 2 };
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Must be at least 3 characters';
  if (username.length > 24) return 'Must be 24 characters or fewer';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Only letters, numbers, and underscores allowed';
  return null;
}
