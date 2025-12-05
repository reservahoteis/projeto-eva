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

      // Get tenant from hostname - SEMPRE verificar primeiro
      const hostname = window.location.hostname;

      // Domínios que usam tenant padrão hoteis-reserva
      const defaultTenantDomains = [
        'www.botreserva.com.br',
        'botreserva.com.br',
        'develop.botreserva.com.br',
        'app.botreserva.com.br',
        'localhost',
        '127.0.0.1'
      ];

      // Subdomínios que NÃO são tenants (são ambientes)
      const nonTenantSubdomains = ['www', 'api', 'app', 'develop', 'staging', 'admin'];

      let tenantSlug: string;

      // Para domínios conhecidos ou Vercel, SEMPRE usar tenant padrão
      if (defaultTenantDomains.includes(hostname) || hostname.includes('vercel.app')) {
        tenantSlug = 'hoteis-reserva'; // Tenant padrão
      }
      // Para subdomínios que são tenants reais (ex: hotel1.botreserva.com.br)
      else {
        const parts = hostname.split('.');
        if (parts.length > 2 && !nonTenantSubdomains.includes(parts[0])) {
          tenantSlug = parts[0];
        } else {
          tenantSlug = 'hoteis-reserva'; // Fallback
        }
      }

      // Salva o tenant slug no localStorage (sobrescreve valor antigo incorreto)
      localStorage.setItem('tenantSlug', tenantSlug);

      // Add x-tenant-slug header (MINÚSCULO - backend espera este formato)
      if (config.headers && tenantSlug) {
        config.headers['x-tenant-slug'] = tenantSlug;
      }

      // Debug log para verificar headers sendo enviados
      console.log('Request headers:', {
        url: config.url,
        'x-tenant-slug': config.headers['x-tenant-slug'],
        Authorization: config.headers.Authorization ? 'Bearer [TOKEN]' : 'None'
      });
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

    // Log de erro para debug
    if (error.response?.status === 404 && error.response?.data) {
      console.error('API Error 404:', error.response.data);
    }

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
            localStorage.removeItem('tenantSlug');
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