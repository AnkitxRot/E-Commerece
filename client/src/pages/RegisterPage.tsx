import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@audio-commerce/shared';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const result = registerSchema.safeParse({ email, password, name });
    if (!result.success) {
      const errors: { name?: string; email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as 'name' | 'email' | 'password' | undefined;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await register(result.data);
      navigate('/account');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to create your account right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink mb-6" style={{ letterSpacing: 'var(--tracking-display)' }}>
        Create account
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input id="name" label="Name" value={name} error={fieldErrors.name} onChange={(e) => setName(e.target.value)} />
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={submitting}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
