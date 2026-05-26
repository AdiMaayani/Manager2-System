import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ensureValidToken, getReturnUrl, clearReturnUrl } from '@api/auth';
import { LoginForm } from '../../components/LoginForm';
import { useLogin } from '../../hooks/useLogin';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { isSubmitting, error, submitAsync } = useLogin();

  useEffect(() => {
    if (ensureValidToken()) {
      const returnUrl = getReturnUrl();
      clearReturnUrl();
      navigate(returnUrl || '/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="loginPage">
      <div className="loginPage__card">
        <div className="loginPage__logo">
          <img src="/logo.png" alt="ManageR²" className="loginPage__logoImg" />
        </div>
        <div className="loginPage__body">
          <h1 className="loginPage__title">התחברות למערכת</h1>
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
