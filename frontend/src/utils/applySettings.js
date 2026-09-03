import i18n from '../i18n';

export const applyUserSettings = (settings) => {
  if (!settings) return;

  // 1. Language application
  const lang = settings.language || 'en';
  if (i18n && typeof i18n.changeLanguage === 'function') {
    i18n.changeLanguage(lang);
  }
  const select = document.querySelector('.goog-te-combo');
  if (select) {
    select.value = lang;
    select.dispatchEvent(new Event('change'));
  } else {
    document.cookie = `googtrans=/en/${lang}; path=/`;
    document.cookie = `googtrans=/en/${lang}; domain=${window.location.hostname}; path=/`;
  }

  // 2. Accessibility - Font Size
  const fontSize = settings.accessibility?.fontSize || 'normal';
  const targetSize = fontSize === 'large' ? '18px' : fontSize === 'xlarge' ? '20px' : '16px';
  document.documentElement.style.fontSize = targetSize;
  if (document.body) document.body.style.fontSize = targetSize;

  // 3. High Contrast Mode
  const isHighContrast = !!settings.accessibility?.highContrast;
  document.documentElement.classList.toggle('high-contrast-mode', isHighContrast);
  if (document.body) document.body.classList.toggle('high-contrast-mode', isHighContrast);

  // 4. Reduce Animations
  const isReduceAnim = !!settings.accessibility?.reduceAnimations;
  document.documentElement.classList.toggle('reduce-animations', isReduceAnim);
  if (document.body) document.body.classList.toggle('reduce-animations', isReduceAnim);

  // 5. Screen Reader Support
  const isScreenReader = !!settings.accessibility?.screenReader;
  if (isScreenReader) {
    document.documentElement.setAttribute('data-screen-reader', 'true');
    if (document.body) document.body.setAttribute('data-screen-reader', 'true');
  } else {
    document.documentElement.removeAttribute('data-screen-reader');
    if (document.body) document.body.removeAttribute('data-screen-reader');
  }
};

