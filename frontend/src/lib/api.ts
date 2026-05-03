import { useAuthStore } from '@/store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function fetchClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers: customHeaders, ...customConfig } = options;
  const token = useAuthStore.getState().token;

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method: customConfig.method || 'GET',
    headers,
    ...customConfig,
    body: customConfig.body as BodyInit,
  };

  if (config.body && typeof customConfig.body === 'object' && !(customConfig.body instanceof FormData)) {
    config.body = JSON.stringify(customConfig.body);
  }

  // Se for FormData, o browser deve definir o Content-Type automaticamente (para incluir boundaries)
  if (customConfig.body instanceof FormData) {
    delete (headers as Record<string, string>)['Content-Type'];
  }

  const response = await fetch(url.toString(), config);

  if (!response.ok) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
    }
    const errorData = await response.json().catch(() => null);
    throw new ApiError(response.status, errorData?.message || response.statusText, errorData);
  }

  // Verifica se a resposta não está vazia (ex: 204 No Content)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return null as unknown as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => fetchClient<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body: unknown, options?: RequestOptions) => fetchClient<T>(endpoint, { ...options, body, method: 'POST' }),
  put: <T>(endpoint: string, body: unknown, options?: RequestOptions) => fetchClient<T>(endpoint, { ...options, body, method: 'PUT' }),
  delete: <T>(endpoint: string, options?: RequestOptions) => fetchClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
