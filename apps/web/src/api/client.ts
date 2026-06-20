import { getAuthToken, redirectToLogin } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  status: number;
  responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text || null;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof (body as Record<string, unknown>).message === 'string'
  ) {
    return (body as Record<string, string>).message;
  }
  return `Request failed with status ${status}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const responseBody = await parseBody(response);

  if (!response.ok) {
    const message = extractErrorMessage(responseBody, response.status);
    const isLoginRequest = path === '/Users/login';
    if (response.status === 401 && !isLoginRequest) {
      redirectToLogin();
    }
    throw new ApiError(message, response.status, responseBody);
  }

  return responseBody as T;
}

export async function apiBlobRequest(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const responseBody = await parseBody(response);
    const message = extractErrorMessage(responseBody, response.status);
    if (response.status === 401) {
      redirectToLogin();
    }
    throw new ApiError(message, response.status, responseBody);
  }

  return response.blob();
}
