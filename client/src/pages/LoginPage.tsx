import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema } from '@audio-commerce/shared';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setServerError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Please enter a valid email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(result.data);
      navigate('/account');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to log in right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink mb-6" style={{ letterSpacing: 'var(--tracking-display)' }}>
        Log in
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldError && (
          <p role="alert" className="text-sm text-danger">
            {fieldError}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={submitting}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        No account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}
