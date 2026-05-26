import { useState, type FormEvent } from 'react';
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
      {error && (
        <div className="loginForm__error" role="alert">
          {error}
        </div>
      )}

      <div className="loginForm__field">
        <input
          className="loginForm__input"
          type="email"
          id="email"
          name="email"
          placeholder="אימייל"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="loginForm__field">
        <input
          className="loginForm__input"
          type="password"
          id="password"
          name="password"
          placeholder="סיסמה"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <button
        className="loginForm__submit"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'מתחבר...' : 'התחבר'}
      </button>
    </form>
  );
}
