import axios from 'axios';
import { API_URL } from '../config';
import { TokenStorage } from './storage';
import secureStorage from './secureStorage';
import apiSecurityManager, { setupAPISecurityInterceptors } from './apiSecurity';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': '1.0.0',
    'X-Platform': 'mobile'
  },
});

// Initialize security managers
let securityInitialized = false;

const initializeSecurity = async () => {
  if (securityInitialized) return;
  
  try {
    await secureStorage.initialize();
    await apiSecurityManager.initialize();
    setupAPISecurityInterceptors(api, apiSecurityManager);
    securityInitialized = true;
    console.log('[API] Security initialized');
  } catch (err) {
    console.warn('[API] Security initialization failed:', err);
  }
};

// Initialize on module load
initializeSecurity();

api.interceptors.request.use(async (config) => {
  // Get token from secure storage
  const token = await TokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Add security timestamp
  config.headers['X-Request-Time'] = new Date().toISOString();
  
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await TokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        const newToken = data.access_token;
        await TokenStorage.setTokens(newToken, refreshToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err);
        await TokenStorage.clearTokens();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
