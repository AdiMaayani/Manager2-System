import { useState, type FormEvent } from 'react';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { InlineAlert } from '@shared/components/InlineAlert';
import type { LoginFormValues } from '../../types';
import './LoginForm.css';

interface LoginFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (values: LoginFormValues) => void;
}

export function LoginForm({ isSubmitting, error, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit({ email: email.trim().toLowerCase(), password });
  }

  return (
    <form className="loginForm" onSubmit={handleSubmit} noValidate>
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}

      <Input
        type="email"
        id="email"
        name="email"
        label="אימייל"
        placeholder="אימייל"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isSubmitting}
      />

      <Input
        type="password"
        id="password"
        name="password"
        label="סיסמה"
        placeholder="סיסמה"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isSubmitting}
      />

      <Button type="submit" className="loginForm__submit" isLoading={isSubmitting}>
        התחבר
      </Button>
    </form>
  );
}
