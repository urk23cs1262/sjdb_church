import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const UPLOADS_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') + '/uploads'
  : '/uploads';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Don't intercept or clear token for failed credentials on login or OTP endpoints
      const isAuthEndpoint = err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/auth/verify-otp');
      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          }
        }
      }
    }
    return Promise.reject(err);
  }
);


export const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) return path;
  
  const baseUrl = UPLOADS_URL.replace(/\/uploads\/?$/, '');

  // If path is a 24-character MongoDB GridFS ObjectId
  if (/^[a-fA-F0-9]{24}$/.test(path)) {
    return `${baseUrl}/api/files/${path}`;
  }

  if (path.startsWith('/api/files/') || path.startsWith('api/files/')) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

export { API_URL, UPLOADS_URL };
export default api;

