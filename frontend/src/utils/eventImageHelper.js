/**
 * Event Image Resolver & Fallback Utility
 * St. John de Britto Church
 * 
 * Ensures all event images resolve to production-accessible URLs
 * across Vercel (frontend) and Render (backend) without broken icons.
 */

import churchLogo from '../assets/church_extirior.png';

const BACKEND_PROD_URL = 'https://st-jb-church.onrender.com';

export const FALLBACK_EVENT_IMAGE = churchLogo;

/**
 * Normalizes an image path to a fully qualified, production-accessible URL
 * @param {string} imagePath 
 * @returns {string} Safe image URL
 */
export function resolveEventImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return FALLBACK_EVENT_IMAGE;
  }

  const trimmed = imagePath.trim();
  if (!trimmed) {
    return FALLBACK_EVENT_IMAGE;
  }

  // Base64 data URI
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Remote URL handling
  if (/^https?:\/\//i.test(trimmed)) {
    // If it's a localhost/127.0.0.1 URL stored during local development:
    // In production or when accessed remotely, re-route to Render backend
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
      if (import.meta.env.PROD) {
        const pathPart = trimmed.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
        const cleanPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
        return `${BACKEND_PROD_URL}${cleanPath}`;
      }
    }
    return trimmed;
  }

  // Derive backend host base
  const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
  let backendHost = '';

  if (import.meta.env.VITE_MEDIA_BASE_URL) {
    backendHost = import.meta.env.VITE_MEDIA_BASE_URL.replace(/\/+$/, '');
  } else if (apiBase && /^https?:\/\//i.test(apiBase)) {
    backendHost = apiBase.replace(/\/api\/?$/, '');
  } else if (import.meta.env.PROD) {
    backendHost = BACKEND_PROD_URL;
  }

  // If path is a 24-character MongoDB GridFS ObjectId
  if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    return backendHost ? `${backendHost}/api/files/${trimmed}` : `/api/files/${trimmed}`;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (backendHost) {
    return `${backendHost}${cleanPath}`;
  }

  return cleanPath;
}

/**
 * Image onError event handler that safely falls back to churchLogo
 * and prevents infinite loop if fallback fails
 */
export function handleImageError(event, customFallback = FALLBACK_EVENT_IMAGE) {
  if (event && event.currentTarget) {
    event.currentTarget.onerror = null;
    event.currentTarget.src = customFallback;
  }
}
