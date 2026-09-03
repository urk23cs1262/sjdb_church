import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

const getVisitorId = () => {
  try {
    let vid = localStorage.getItem('sjdb_visitor_id');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('sjdb_visitor_id', vid);
    }
    return vid;
  } catch {
    return 'v_anonymous_' + Math.random().toString(36).substring(2, 8);
  }
};

export default function PageTracker() {
  const location = useLocation();
  const lastTrackedPath = useRef('');

  useEffect(() => {
    const currentPath = location.pathname;
    // Debounce duplicate hits on identical path
    if (lastTrackedPath.current === currentPath) return;
    lastTrackedPath.current = currentPath;

    // Do not track admin-only internal sub-pages as public visitor views, or track them appropriately
    const visitorId = getVisitorId();
    const referrer = document.referrer || '';
    const pageTitle = document.title || 'St. John de Britto Church';

    // Send beacon request in a non-blocking timeout
    const timer = setTimeout(() => {
      api.post('/analytics/track', {
        path: currentPath,
        pageTitle,
        visitorId,
        referrer
      }).catch(() => {
        // Silently ignore tracking errors
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
}
