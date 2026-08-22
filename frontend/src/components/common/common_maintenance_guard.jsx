import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/context_auth_context';
import api from '../../services/api';
import PageLoader from './common_loader';

// Lazy-load the maintenance page so it is not bundled unless needed
const MaintenancePage = lazy(() => import('../../pages/public/public_maintenance'));

// Storage key for caching maintenance state across navigations
const CACHE_KEY = 'maint_status_cache';

// How often to re-poll the maintenance status (ms)
const POLL_INTERVAL = 15_000;

// Routes always reachable even during maintenance so Admin/Tech Team can log in
const LOGIN_ROUTE = '/login';

function getCachedStatus() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return null;
}

function setCachedStatus(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (_) { /* ignore */ }
}

export default function MaintenanceGuard({ children }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();

  // Seed state from sessionStorage immediately so first render can decide
  // without waiting for the API - eliminates the loader flash on every page.
  const [maintenance, setMaintenance] = useState(() => getCachedStatus());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const checkMaintenance = async () => {
      try {
        const res = await api.get('/maintenance/status');
        if (res.data.success && isMounted.current) {
          setMaintenance(res.data);
          setCachedStatus(res.data);
        }
      } catch (err) {
        // Fail open - if the server cannot be reached, do not block access
        console.warn('MaintenanceGuard: status check failed', err?.message);
        if (isMounted.current && !getCachedStatus()) setMaintenance(null);
      }
    };

    checkMaintenance();
    const interval = setInterval(checkMaintenance, POLL_INTERVAL);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  // Only block on auth loading when we have no cached maintenance info yet
  if (authLoading && maintenance === null) return <PageLoader />;

  // Maintenance is NOT active - let everything through
  if (!maintenance?.isEnabled) return children;

  // Maintenance IS active - /login is always accessible so Admin/Tech Team
  // can enter their credentials. The backend and login page handle the rest.
  if (location.pathname === LOGIN_ROUTE) return children;

  // Check if the logged-in user can bypass maintenance
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin    = ['admin', 'priest'].includes(userRole);
  const isTechTeam =
    Boolean(user?.isTechnicalTeam) ||
    ['staff', 'technical_team', 'tech_team'].includes(userRole);

  const canBypass = isAuthenticated && (isAdmin || isTechTeam);

  // Privileged users (admin / tech-team) see the full site
  if (canBypass) return children;

  // Everyone else - guests and normal users - see the maintenance page
  return (
    <Suspense fallback={<PageLoader />}>
      <MaintenancePage />
    </Suspense>
  );
}
