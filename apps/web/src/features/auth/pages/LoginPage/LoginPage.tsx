import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ensureValidToken,
  getReturnUrl,
  clearReturnUrl,
  peekSessionExpiredNotice,
  clearSessionExpiredNotice,
} from '@api/auth';
import { LoginForm } from '../../components/LoginForm';
import { useLogin } from '../../hooks/useLogin';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { isSubmitting, error, submitAsync } = useLogin();

  // Read the one-shot session-expired notice once at mount (pure read keeps the initializer
  // StrictMode-safe); the flag itself is cleared in the effect below.
  const [showSessionExpiredNotice] = useState(peekSessionExpiredNotice);

  useEffect(() => {
    if (ensureValidToken()) {
      const returnUrl = getReturnUrl();
      clearReturnUrl();
      navigate(returnUrl || '/', { replace: true });
      return;
    }

    clearSessionExpiredNotice();
  }, [navigate]);

  return (
    <div className="loginPage">
      <div className="loginPage__ambient loginPage__ambient--primary" />
      <div className="loginPage__ambient loginPage__ambient--secondary" />
      <div className="loginPage__card">
        <div className="loginPage__logo">
          <img src="/logo.png" alt="ManageR²" className="loginPage__logoImg" />
          <p className="loginPage__eyebrow">ManageR²</p>
        </div>
        <div className="loginPage__body">
          <h1 className="loginPage__title">התחברות למערכת</h1>
          <p className="loginPage__subtitle">ניהול פרויקטים, ציוד והצעות מחיר במקום אחד</p>
          {showSessionExpiredNotice && (
            <div className="loginPage__notice" role="status">
              פג תוקף ההתחברות. יש להתחבר מחדש.
            </div>
          )}
          <LoginForm
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={submitAsync}
          />
        </div>
      </div>
    </div>
  );
}
