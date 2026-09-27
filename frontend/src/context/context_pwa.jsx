import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const PWAContext = createContext(null);

export function PWAProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installState, setInstallState] = useState('idle'); // 'idle' | 'installing' | 'complete' | 'ios-guide' | 'manual-guide'

  // Ref to hold deferredPrompt for fresh access in callbacks without stale closures
  const deferredPromptRef = useRef(null);

  // 1. Detect if running in standalone/installed mode or already installed on this device
  const checkIsInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isStandaloneDisplay = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator && window.navigator.standalone === true;
    const isAndroidAppReferrer = typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://');
    const isLocalStorageMarked = localStorage.getItem('pwa_app_installed') === 'true';
    return Boolean(isStandaloneDisplay || isIOSStandalone || isAndroidAppReferrer || isLocalStorageMarked);
  }, []);

  // 2. Detect iOS / iPadOS
  const detectIOS = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return Boolean(isAppleDevice || isIPadOS);
  }, []);

  useEffect(() => {
    const installed = checkIsInstalled();
    setIsInstalled(installed);
    setIsIOS(detectIOS());

    // Listen for changes in display mode (e.g. user launches the site from their home screen icon)
    let mediaQuery = null;
    try {
      mediaQuery = window.matchMedia('(display-mode: standalone)');
    } catch (_) { }

    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem('pwa_app_installed', 'true');
        setShowModal(false);
      }
    };

    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleDisplayModeChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleDisplayModeChange);
      }
    }

    // Capture beforeinstallprompt for Chromium browsers (Chrome, Edge, Samsung Internet)
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser's automatic mini-infobar
      e.preventDefault();
      deferredPromptRef.current = e;
      setDeferredPrompt(e);
      setInstallState(prev => prev === 'manual-guide' ? 'idle' : prev);
    };

    // Capture appinstalled event (fired when browser completes installation)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      localStorage.setItem('pwa_app_installed', 'true');
      setInstallState('complete');
      setTimeout(() => {
        setShowModal(false);
        setInstallState('idle');
      }, 1600);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleDisplayModeChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleDisplayModeChange);
        }
      }
    };
  }, [checkIsInstalled, detectIOS]);

  // 3. Post-login installation prompt check
  const checkPostLoginPrompt = useCallback((isUserAuth = false) => {
    if (typeof window === 'undefined') return;

    // Never show if already running as an installed PWA or already recorded as installed
    if (checkIsInstalled()) {
      return;
    }

    // Check if this was marked by a successful login OR user is authenticated
    const isPendingPrompt = sessionStorage.getItem('pwa_prompt_after_login') === 'true';
    if (!isPendingPrompt && !isUserAuth) return;

    // Clear the pending prompt flag
    sessionStorage.removeItem('pwa_prompt_after_login');

    // Never show if dismissed in this current session
    if (sessionStorage.getItem('pwa_install_dismissed_session') === 'true') {
      return;
    }

    // Never show on auth/maintenance pages
    const path = window.location.pathname;
    if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/maintenance')) {
      return;
    }

    // Gentle delay after login navigation so user sees their destination page cleanly
    const timer = setTimeout(() => {
      if (checkIsInstalled()) return;
      if (sessionStorage.getItem('pwa_install_dismissed_session') === 'true') return;

      const ios = detectIOS();
      if (ios) {
        setInstallState('ios-guide');
      } else if (deferredPromptRef.current) {
        setInstallState('idle');
      } else {
        setInstallState('manual-guide');
      }
      setShowModal(true);
    }, 700);

    return () => clearTimeout(timer);
  }, [checkIsInstalled, detectIOS]);

  // 4. "Not Now" / Dismiss handler
  const dismissInstallPrompt = useCallback(() => {
    try {
      sessionStorage.setItem('pwa_install_dismissed_session', 'true');
    } catch (_) { }
    setShowModal(false);
    setInstallState('idle');
  }, []);

  // 5. Open install modal manually (e.g. from navbar button)
  const openInstallModal = useCallback(() => {
    if (checkIsInstalled()) return;
    if (detectIOS()) {
      setInstallState('ios-guide');
    } else if (deferredPromptRef.current) {
      setInstallState('idle');
    } else {
      setInstallState('manual-guide');
    }
    setShowModal(true);
  }, [checkIsInstalled, detectIOS]);

  // 6. Trigger native installation prompt
  const triggerInstall = useCallback(async () => {
    if (detectIOS()) {
      setInstallState('ios-guide');
      setShowModal(true);
      return;
    }

    const promptEvent = deferredPromptRef.current || deferredPrompt;
    if (!promptEvent) {
      // Browser doesn't support or hasn't fired beforeinstallprompt; show manual guide
      setInstallState('manual-guide');
      setShowModal(true);
      return;
    }

    try {
      setInstallState('installing');
      setShowModal(true);
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;

      if (choiceResult && choiceResult.outcome === 'accepted') {
        deferredPromptRef.current = null;
        setDeferredPrompt(null);
        localStorage.setItem('pwa_app_installed', 'true');
      } else {
        // User cancelled the native browser prompt; dismiss dialog for current session
        try {
          sessionStorage.setItem('pwa_install_dismissed_session', 'true');
        } catch (_) { }
        setInstallState('idle');
        setShowModal(false);
      }
    } catch (err) {
      console.warn('[PWA] Prompt execution error:', err);
      setInstallState('idle');
      setShowModal(false);
    }
  }, [deferredPrompt, detectIOS]);

  return (
    <PWAContext.Provider
      value={{
        deferredPrompt,
        isInstalled,
        isIOS,
        showModal,
        installState,
        setInstallState,
        openInstallModal,
        closeInstallModal: dismissInstallPrompt,
        dismissInstallPrompt,
        triggerInstall,
        checkPostLoginPrompt
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}
