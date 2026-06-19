import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthSession, clearReturnUrl, getReturnUrl } from '@api/auth';
import { ApiError } from '@api/client';
import { loginUserAsync } from '../api/authApiClient';
import type { LoginFormValues } from '../types';

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
      const response = await loginUserAsync(values);

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
        } else if (err.status === 423) {
          setError('החשבון ננעל זמנית עקב ניסיונות התחברות כושלים. נסה שוב מאוחר יותר.');
        } else if (err.status === 429) {
          setError('יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות.');
        } else if (err.status === 400) {
          setError(err.message || 'הבקשה אינה תקינה.');
        } else {
          // 5xx / unexpected statuses: never surface the raw English "Request failed with status N".
          setError('אירעה שגיאה בעת ההתחברות. נסה שוב מאוחר יותר.');
        }
      } else {
        // Network/connection failures (e.g. "Failed to fetch") should read as Hebrew, not raw text.
        setError('לא ניתן להתחבר לשרת. בדוק את החיבור ונסה שוב.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, error, submitAsync };
}
