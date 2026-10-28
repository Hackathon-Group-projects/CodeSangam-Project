// Backend API ka base address (environment variable se ya default localhost:4000)
// Next.js mein NEXT_PUBLIC_ wali setting browser tak ja sakti hai; isliye yahan sirf server ka address rakha hai.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// TS CONCEPT (interface & Generic <T>): 
// Interface ka matlab plain JS object ka shape define karna.
// <T = any> ka matlab 'data' field me ticket object bhi aa sakta hai ya array bhi, jo bhi API bhejegi.
export interface ApiResponse<T = any> {
  success: boolean;  // Request kamiyab hui ya nahi (true/false)
  data?: T;          // '?' ka matlab ye field optional hai (sirf success par aayegi)
  message?: string;  // Server se aane wala message
  error?: string;    // Agar fail hua toh error message
}

// generateIdempotencyKey: Double-click ya slow internet par duplicate petition create na ho,
// isliye har POST request ke liye ek unique random UUID string banata hai.
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID(); // Modern browser ka native UUID generator
  }
  return 'idem_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// apiFetch: Reusable function jo vanilla JavaScript ke fetch() ko super-power deta hai
// TS CONCEPT (<T>): Jab aap apiFetch<User> likhoge toh JS automatically response ko User type me treat karegi
export async function apiFetch<T>(
  endpoint: string,             // Endpoint path (e.g. '/api/tickets')
  options: RequestInit = {}     // Fetch options jaise method, body, headers
): Promise<ApiResponse<T>> {
  // 1. Full URL taiyyar karte hain (http://localhost:4000/api/...)
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  // 2. Agar FormData nahi hai, toh Content-Type ko application/json set karte hain
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 3. Agar user logged in hai, toh localStorage se JWT token nikal kar Authorization header jodte hain
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('vishanti_auth_token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // 4. Sabhi mutating requests (POST, PATCH, PUT) me automatic Idempotency-Key header jodte hain
  if (['POST', 'PATCH', 'PUT'].includes((options.method || 'GET').toUpperCase())) {
    if (!headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', generateIdempotencyKey());
    }
  }

  try {
    // 5. Asli network request bheji jaati hai
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 6. JSON response parse karte hain
    const data = await response.json().catch(() => ({}));

    // 7. Agar status code 200-299 nahi hai (e.g. 400, 500), toh error return karte hain
    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `HTTP Error ${response.status}`,
      };
    }

    // 8. Success data return karte hain
    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  } catch (err: any) {
    // 9. Network drop ya backend offline hone par catch block chalega
    return {
      success: false,
      error: err.message || 'Network connection failed',
    };
  }
}
