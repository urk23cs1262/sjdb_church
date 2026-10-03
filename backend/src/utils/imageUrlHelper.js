/**
 * Image URL Normalizer Utility
 * St. John de Britto Church
 * 
 * Ensures all image paths stored in MongoDB or returned to the client
 * are production-accessible URLs that resolve across Vercel (frontend)
 * and Render (backend) architectures.
 */

function getBackendPublicUrl() {
  const envUrl = process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }
  // In production mode, default to canonical Render host
  if (process.env.NODE_ENV === 'production') {
    return 'https://st-jb-church.onrender.com';
  }
  return envUrl ? envUrl.replace(/\/+$/, '') : 'http://localhost:5000';
}

/**
 * Normalizes an image path or URL into a production-safe public URL
 * @param {string} imagePath 
 * @returns {string} Fully qualified production-safe URL or empty string
 */
function resolveBackendImageUrl(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return '';
  const trimmed = imagePath.trim();
  if (!trimmed) return '';

  // Already a valid remote non-localhost HTTPS/HTTP URL
  if (/^https?:\/\//i.test(trimmed)) {
    // If it's a localhost URL, convert to backend public URL in production
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
      const pathPart = trimmed.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
      const backendBase = getBackendPublicUrl();
      const cleanPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
      return `${backendBase}${cleanPath}`;
    }
    return trimmed;
  }

  // Base64 Data URI
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  const backendBase = getBackendPublicUrl();

  // If path is a 24-char MongoDB ObjectId
  if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    return `${backendBase}/api/files/${trimmed}`;
  }

  // If path starts with /api/files/ or /uploads/
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendBase}${cleanPath}`;
}

module.exports = {
  getBackendPublicUrl,
  resolveBackendImageUrl
};
