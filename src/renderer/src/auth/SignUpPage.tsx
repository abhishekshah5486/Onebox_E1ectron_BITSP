import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { AuthCard } from './AuthCard';
import { useAuth } from './AuthProvider';
import { describeError } from './errors';

const MIN_PASSWORD = 10;

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const passwordTooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD;
  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = async () => {
    setTouched(true);
    if (!form.name.trim() || !form.email || form.password.length < MIN_PASSWORD) {
      setError('Fill in every field to create your account.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signUp({ ...form, name: form.name.trim() });
      void navigate('/inbox', { replace: true });
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="One inbox for every mailbox you own"
      error={error}
      onSubmit={() => void submit()}
      actions={
        <>
          <ButtonLink to="/signin" variant="text">
            Sign in instead
          </ButtonLink>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </Button>
        </>
      }
    >
      <TextField
        label="Full name"
        autoComplete="name"
        autoFocus
        value={form.name}
        onChange={update('name')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={update('email')}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={update('password')}
        error={touched && passwordTooShort ? `Use at least ${MIN_PASSWORD} characters` : undefined}
        hint={`Use ${MIN_PASSWORD} or more characters`}
      />
    </AuthCard>
  );
}
