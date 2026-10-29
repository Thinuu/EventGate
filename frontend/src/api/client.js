import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBase } from '../utils/backend';

const apiBase = getApiBase();

const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('entrynex_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const deviceId = localStorage.getItem('deviceId');
  if (deviceId) config.headers['x-device-id'] = deviceId;

  // If data is FormData, let axios set the correct Content-Type with boundary
  if (config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
      config.headers.delete('content-type');
    } else {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response?.data && typeof response.data === 'object' && !('data' in response.data)) {
      response.data.data = {};
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!error.response) {
      toast.error('Backend not reachable. Please start the server.');
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized (Expired Token)
    if (status === 401 && !originalRequest._retry) {
      if (originalRequest.skipAuthRedirect || originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/me')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        const res = await axios.post(`${apiBase}/auth/refresh-token`, {}, { withCredentials: true });
        if (res.data.success) {
          const newToken = res.data.accessToken;
          localStorage.setItem('entrynex_token', newToken);
          api.defaults.headers.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token failed/expired
        localStorage.removeItem('entrynex_token');
        localStorage.removeItem('entrynex_user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (status === 403) {
      toast.error(error.response?.data?.message || 'Access denied (403).');
    }

    return Promise.reject(error);
  }
);

export default api;
