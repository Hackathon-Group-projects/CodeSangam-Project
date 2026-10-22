const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Generate crypto-safe random UUID for Idempotency-Key
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Base Fetch Wrapper
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach auth token if present in localStorage or cookies
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('vishanti_auth_token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Automatically attach Idempotency-Key for POST / PATCH / PUT requests if not already provided
  if (['POST', 'PATCH', 'PUT'].includes((options.method || 'GET').toUpperCase())) {
    if (!headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', generateIdempotencyKey());
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `HTTP Error ${response.status}`,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network connection failed',
    };
  }
}
