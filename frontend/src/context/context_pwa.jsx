import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PWAContext = createContext(null);

export function PWAProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installState, setInstallState] = useState('idle'); // 'idle' | 'installing' | 'complete' | 'ios-guide'

  // Determine if running in standalone/installed mode
  const checkIsInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator?.standalone === true;
    const isAndroidAppReferrer = typeof document !== 'undefined' && document.referrer.includes('android-app://');
    return isStandaloneDisplay || isIOSStandalone || isAndroidAppReferrer;
  }, []);

  // Detect iOS / iPadOS
  const detectIOS = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleDevice || isIPadOS;
  }, []);

  useEffect(() => {
    const installed = checkIsInstalled();
    setIsInstalled(installed);
    setIsIOS(detectIOS());

    // Listen for changes in display mode (e.g. launching as installed app)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true);
        setShowModal(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // Capture beforeinstallprompt for Chromium browsers
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Capture appinstalled event (fired when browser completes installation)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstallState('complete');
      // Auto-close dialog after visual completion
      setTimeout(() => {
        setShowModal(false);
        setInstallState('idle');
      }, 1800);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, [checkIsInstalled, detectIOS]);

  // Check for post-login prompt trigger (Mandatory: triggers if not installed in this browser)
  const checkPostLoginPrompt = useCallback(() => {
    if (typeof window === 'undefined') return;
    const isPendingPrompt = sessionStorage.getItem('pwa_prompt_after_login') === 'true';
    if (!isPendingPrompt) return;

    // Clear the trigger flag
    sessionStorage.removeItem('pwa_prompt_after_login');

    const alreadyInstalled = checkIsInstalled();
    if (alreadyInstalled) {
      return;
    }

    // Gentle delay after login navigation so user sees destination first
    const timer = setTimeout(() => {
      const iosDevice = detectIOS();
      if (iosDevice) {
        setInstallState('ios-guide');
      } else {
        setInstallState('idle');
      }
      setShowModal(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [checkIsInstalled, detectIOS]);

  useEffect(() => {
    checkPostLoginPrompt();
  }, [checkPostLoginPrompt]);

  const openInstallModal = useCallback(() => {
    if (checkIsInstalled()) return;
    if (detectIOS()) {
      setInstallState('ios-guide');
    } else {
      setInstallState('idle');
    }
    setShowModal(true);
  }, [checkIsInstalled, detectIOS]);

  const closeInstallModal = useCallback(() => {
    // Only used for completed installation or iOS dismissed guidance
    setShowModal(false);
    setInstallState('idle');
  }, []);

  const triggerInstall = useCallback(async () => {
    if (detectIOS()) {
      setInstallState('ios-guide');
      return;
    }

    if (!deferredPrompt) {
      // If browser doesn't have deferredPrompt ready yet, keep in idle
      setInstallState('idle');
      return;
    }

    try {
      setInstallState('installing');
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        // App is installing; keep dialog open in 'installing' state until 'appinstalled' event fires
        setDeferredPrompt(null);
      } else {
        // User cancelled native prompt; return to idle state so they can click Install App again
        setInstallState('idle');
      }
    } catch (err) {
      console.warn('[PWA] Prompt error:', err);
      setInstallState('idle');
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
        closeInstallModal,
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
