import { isMockDataMode } from '@/config/appConfig';

const SESSION_TOKEN_KEY = 'manager2_token';
const MOCK_TOKEN = 'mock-jwt-token';
const SESSION_USER_KEY = 'manager2_user';
const SESSION_RETURN_URL_KEY = 'manager2_return_url';
const SESSION_EXPIRED_NOTICE_KEY = 'manager2_session_expired';

export interface AuthUser {
  userId: number;
  employeeId: number;
  username: string;
  email: string;
  isActive: boolean;
  roles: string[];
  departments: string[];
}

export interface LoginResponse {
  token: string;
  userId: number;
  employeeId: number;
  username: string;
  email: string;
  isActive: boolean;
  roles: string[];
  departments: string[];
}

export function getAuthToken(): string {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) ?? '';
}

export function setAuthSession(response: LoginResponse): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, response.token);
  sessionStorage.setItem(
    SESSION_USER_KEY,
    JSON.stringify({
      userId: response.userId,
      employeeId: response.employeeId,
      username: response.username,
      email: response.email,
      isActive: response.isActive,
      roles: Array.isArray(response.roles) ? response.roles : [],
      departments: Array.isArray(response.departments) ? response.departments : [],
    } satisfies AuthUser),
  );
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const raw = sessionStorage.getItem(SESSION_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getRoleDisplayLabel(role?: string | null): string {
  const normalizedRole = String(role ?? '').trim();
  if (!normalizedRole) return 'מחובר';

  const roleLabels: Record<string, string> = {
    Admin: 'מנהל',
    SeniorManagement: 'הנהלה בכירה',
    ProjectManager: 'מנהל פרויקטים',
    Office: 'משרד',
    Technician: 'טכנאי',
    Inventory: 'מלאי',
    DepartmentManager: 'מנהל מחלקה',
    TeamLeader: 'ראש צוות',
  };

  return roleLabels[normalizedRole] ?? normalizedRole;
}

export function isTokenExpired(token: string): boolean {
  if (isMockDataMode && token === MOCK_TOKEN) return false;
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    clearAuthSession();
    return true;
  }
}

export function ensureValidToken(): boolean {
  const token = getAuthToken();
  if (!token || isTokenExpired(token)) {
    clearAuthSession();
    return false;
  }
  return true;
}

function isAppLoginPath(pathname: string): boolean {
  return pathname === '/login';
}

function isSafeReturnUrl(url: string): boolean {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return false;
  if (url.startsWith('/Users') || url.startsWith('/api')) return false;
  if (isAppLoginPath(url.split('?')[0] ?? '')) return false;
  return true;
}

export function setReturnUrl(url: string): void {
  if (isSafeReturnUrl(url)) {
    sessionStorage.setItem(SESSION_RETURN_URL_KEY, url);
  }
}

export function getReturnUrl(): string {
  const url = sessionStorage.getItem(SESSION_RETURN_URL_KEY) ?? '';
  return isSafeReturnUrl(url) ? url : '';
}

export function clearReturnUrl(): void {
  sessionStorage.removeItem(SESSION_RETURN_URL_KEY);
}

// Records that the session expired so the login page can show a non-blocking notice instead of a blocking alert().
export function flagSessionExpired(): void {
  sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
}

// Pure read of the session-expired notice (no mutation) — safe to call from a render-time state initializer.
export function peekSessionExpiredNotice(): boolean {
  return sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1';
}

// Clears the one-shot session-expired notice; call from an effect after it has been read.
export function clearSessionExpiredNotice(): void {
  sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
}

export function redirectToLogin(): void {
  const { pathname, search } = window.location;
  const returnTarget = `${pathname}${search}`;

  if (isSafeReturnUrl(returnTarget)) {
    setReturnUrl(returnTarget);
  } else {
    clearReturnUrl();
  }

  clearAuthSession();

  if (!isAppLoginPath(pathname)) {
    window.location.replace('/login');
  }
}
