import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  ensureValidToken,
  flagSessionExpired,
  redirectToLogin,
  setReturnUrl,
} from '@api/auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ensureValidToken()) {
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!ensureValidToken()) {
        clearInterval(intervalRef.current!);
        flagSessionExpired();
        redirectToLogin();
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!ensureValidToken()) {
    const returnTarget = `${location.pathname}${location.search}`;
    setReturnUrl(returnTarget);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
