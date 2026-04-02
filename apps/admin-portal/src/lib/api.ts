'use client';

import { createClient } from '@/lib/supabase/client';

type RequestOptions = {
  headers?: HeadersInit;
  body?: unknown;
};

const baseURL = process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error('NEXT_PUBLIC_API_URL is not defined');
}

async function request(path: string, method: string, options: RequestOptions = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Request failed');
  }

  return payload;
}

const apiClient = {
  get(path: string, headers?: HeadersInit) {
    return request(path, 'GET', { headers });
  },
  post(path: string, body?: unknown, headers?: HeadersInit) {
    return request(path, 'POST', { body, headers });
  },
  patch(path: string, body?: unknown, headers?: HeadersInit) {
    return request(path, 'PATCH', { body, headers });
  },
  delete(path: string, headers?: HeadersInit) {
    return request(path, 'DELETE', { headers });
  },
};

export default apiClient;
