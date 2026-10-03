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


const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL ||
  (import.meta.env.PROD
    ? (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'https://st-jb-church.onrender.com')
    : '');

export const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('data:')) return path;

  const backendHost = import.meta.env.VITE_MEDIA_BASE_URL ||
    (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : '') ||
    (import.meta.env.PROD ? 'https://st-jb-church.onrender.com' : '');

  // If already remote HTTP/HTTPS
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (import.meta.env.PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(path)) {
      const pathPart = path.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
      const cleanPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
      return backendHost ? `${backendHost}${cleanPath}` : cleanPath;
    }
    return path;
  }
  
  // Stream static devotional songs & Rosary audio from persistent media host in production
  if (path.startsWith('/devotional-songs/') || path.startsWith('devotional-songs/')) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return backendHost ? `${backendHost}${cleanPath}` : cleanPath;
  }

  // If path is a 24-character MongoDB GridFS ObjectId
  if (/^[a-fA-F0-9]{24}$/.test(path)) {
    return backendHost ? `${backendHost}/api/files/${path}` : `/api/files/${path}`;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return backendHost ? `${backendHost}${cleanPath}` : cleanPath;
};

export const getFileUrl = getMediaUrl;

export { API_URL, UPLOADS_URL, MEDIA_BASE_URL };
export default api;

