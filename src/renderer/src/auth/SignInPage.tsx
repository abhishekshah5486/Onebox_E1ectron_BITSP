import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { AuthCard } from './AuthCard';
import { useAuth } from './AuthProvider';
import { describeError } from './errors';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      void navigate('/inbox', { replace: true });
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="to continue to OneBox"
      error={error}
      onSubmit={() => void submit()}
      actions={
        <>
          <ButtonLink to="/signup" variant="text">
            Create account
          </ButtonLink>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </>
      }
    >
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </AuthCard>
  );
}
