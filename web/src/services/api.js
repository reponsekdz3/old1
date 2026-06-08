import axios from 'axios';
import webSecurity from './webSecurity';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': '1.0.0',
    'X-Platform': 'web'
  },
  withCredentials: true,
});

// Fetch and cache a CSRF token from the server
let _csrfFetchPromise = null;
async function ensureCSRFToken() {
  const existing = webSecurity.getCSRFToken();
  if (existing) return existing;

  if (!_csrfFetchPromise) {
    _csrfFetchPromise = axios.get(`${API_BASE_URL}/csrf-token`)
      .then(res => {
        const token = res.data?.csrf_token;
        if (token) webSecurity.setCSRFToken(token);
        return token;
      })
      .catch(() => null)
      .finally(() => { _csrfFetchPromise = null; });
  }
  return _csrfFetchPromise;
}

// Add JWT + CSRF token to every request
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // For state-changing requests without JWT, ensure we have a CSRF token
  if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
    if (!token) {
      // Unauthenticated mutating request — fetch CSRF token first
      const csrfToken = await ensureCSRFToken();
      if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      // Authenticated — JWT is the CSRF protection; also add token if cached
      const csrfToken = webSecurity.getCSRFToken();
      if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  config.headers['X-Request-Time'] = new Date().toISOString();
  return config;
}, (error) => Promise.reject(error));

// Handle 401 + token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // If CSRF token expired, clear it and retry once
    if (error.response?.status === 403 &&
        error.response?.data?.error?.includes('CSRF') &&
        !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      localStorage.removeItem('csrf_token');
      const newToken = await ensureCSRFToken();
      if (newToken) {
        originalRequest.headers['X-CSRF-Token'] = newToken;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
