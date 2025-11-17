import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Axios instance configurado com interceptors
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

/**
 * Request interceptor - adiciona token e tenant
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get access token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Get tenant from hostname (subdomain)
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      const subdomain = parts[0];

      // Determine tenant slug
      let tenantSlug = 'super-admin'; // Default para localhost e desenvolvimento

      // Se tiver subdomínio e não for localhost
      if (parts.length > 1 && subdomain !== 'www') {
        tenantSlug = subdomain;
      }

      // Add X-Tenant-Slug header (backend espera este header)
      if (config.headers) {
        config.headers['X-Tenant-Slug'] = tenantSlug;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - trata erros e refresh token
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Token expirado - tenta refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (typeof window !== 'undefined') {
        const refreshToken = localStorage.getItem('refreshToken');

        if (refreshToken) {
          try {
            // Tenta refresh
            const { data } = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken,
            });

            // Salva novo token
            localStorage.setItem('accessToken', data.accessToken);

            // Retry request original
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
            }

            return api(originalRequest);
          } catch (refreshError) {
            // Refresh falhou - desloga
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        } else {
          // Sem refresh token - redireciona para login
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
