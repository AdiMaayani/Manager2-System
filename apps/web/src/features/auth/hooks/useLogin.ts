import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthSession, clearReturnUrl, getReturnUrl } from '@api/auth';
import type { LoginResponse } from '@api/auth';
import { ApiError } from '@api/client';
import { isMockDataMode } from '@/config/appConfig';
import { loginUserAsync } from '../api/authApiClient';
import type { LoginFormValues } from '../types';

function mockLoginResponse(email: string): LoginResponse {
  return {
    token: 'mock-jwt-token', // must match MOCK_TOKEN in auth.ts
    userId: 1,
    employeeId: 1,
    username: 'משתמש דמו',
    email,
    isActive: true,
    roles: ['מנהל'],
    departments: ['ניהול'],
  };
}

interface UseLoginReturn {
  isSubmitting: boolean;
  error: string | null;
  submitAsync: (values: LoginFormValues) => Promise<void>;
}

export function useLogin(): UseLoginReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submitAsync(values: LoginFormValues): Promise<void> {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = isMockDataMode
        ? mockLoginResponse(values.email)
        : await loginUserAsync(values);

      if (!response?.token) {
        throw new Error('התחברות נכשלה. לא התקבל טוקן מהשרת.');
      }

      setAuthSession(response);

      const returnUrl = getReturnUrl();
      clearReturnUrl();
      navigate(returnUrl || '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setError('אימייל או סיסמה שגויים.');
        } else if (err.status === 400) {
          setError(err.message || 'הבקשה אינה תקינה.');
        } else {
          setError(err.message || 'אירעה שגיאה בעת ההתחברות. נסה שוב.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'אירעה שגיאה בעת ההתחברות. נסה שוב.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, error, submitAsync };
}
