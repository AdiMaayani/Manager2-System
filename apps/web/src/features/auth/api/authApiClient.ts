import { apiRequest } from '@api/client';
import type { LoginResponse } from '@api/auth';
import type { LoginFormValues } from '../types';

export async function loginUserAsync(values: LoginFormValues): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/Users/login', {
    method: 'POST',
    body: JSON.stringify({ email: values.email, password: values.password }),
  });
}
