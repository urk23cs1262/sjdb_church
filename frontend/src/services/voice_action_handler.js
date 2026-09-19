/**
 * voice_action_handler.js — Safe Page, Modal & Form Action Executor for Hey Connect
 *
 * Executes user-authorized UI actions without fragile hardcoded selectors:
 * 1. Close Open Modals (Donation modal, Approval modal, etc.)
 * 2. Form Submission with required-fields validation
 * 3. Document / Receipt Download actions
 * 4. Toggle New Request / New Booking forms
 */

/**
 * Checks if any modal or dialog is currently open in the DOM (excluding voice orb itself)
 * and safely triggers its close button.
 * @returns {boolean} True if a modal was found and closed
 */
export function closeOpenModal() {
  // Find visible backdrop/modal containers excluding Hey Connect voice assistant
  const modalOverlays = Array.from(
    document.querySelectorAll('.fixed.inset-0, [role="dialog"], .modal-overlay')
  ).filter((el) => {
    // Exclude Hey Connect container
    if (el.classList.contains('cv-fixed-container') || el.closest('.cv-fixed-container')) {
      return false;
    }
    // Check if visible
    const rect = el.getBoundingClientRect();
    return rect.width > 50 && rect.height > 50;
  });

  if (modalOverlays.length === 0) {
    return false;
  }

  const activeModal = modalOverlays[modalOverlays.length - 1]; // Top-most modal

  // Look for close button inside modal (X icon, Close button, cancel button)
  const closeBtn =
    activeModal.querySelector('button[aria-label*="Close" i]') ||
    activeModal.querySelector('button[title*="Close" i]') ||
    Array.from(activeModal.querySelectorAll('button')).find((btn) => {
      const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      return text === '✕' || text === 'x' || text === 'close' || text === 'cancel';
    }) ||
    activeModal.querySelector('button');

  if (closeBtn) {
    closeBtn.click();
    return true;
  }

  return false;
}

/**
 * Validates and safely submits the active form on the current page.
 * Prevents submitting incomplete forms when required fields are missing.
 * @returns {{ success: boolean, messageEn: string, messageTa: string }}
 */
export function submitActiveForm() {
  // Find visible forms on page (exclude search or hidden forms)
  const forms = Array.from(document.querySelectorAll('form')).filter((f) => {
    const rect = f.getBoundingClientRect();
    return rect.width > 100 && rect.height > 60;
  });

  if (forms.length === 0) {
    return {
      success: false,
      messageEn: 'No active form was found on this page.',
      messageTa: 'இந்தப் பக்கத்தில் படிவம் எதுவும் காணப்படவில்லை.',
    };
  }

  const form = forms[0];

  // Check form validity
  if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
    return {
      success: false,
      messageEn: 'Some required information is missing. Please complete the form before submitting.',
      messageTa: 'சில தேவையான தகவல்கள் விடுபட்டுள்ளன. சமர்ப்பிக்கும் முன் படிவத்தை பூர்த்தி செய்யவும்.',
    };
  }

  // Check required inputs
  const requiredInputs = Array.from(form.querySelectorAll('[required]'));
  const missingField = requiredInputs.find((input) => {
    if (input.type === 'checkbox' || input.type === 'radio') return !input.checked;
    return !input.value || !input.value.trim();
  });

  if (missingField) {
    return {
      success: false,
      messageEn: 'Some required information is missing. Please complete the form before submitting.',
      messageTa: 'சில தேவையான தகவல்கள் விடுபட்டுள்ளன. சமர்ப்பிக்கும் முன் படிவத்தை பூர்த்தி செய்யவும்.',
    };
  }

  // Submit form
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.click();
  } else if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
  } else {
    form.submit();
  }

  return {
    success: true,
    messageEn: 'Submitting the form.',
    messageTa: 'படிவத்தை சமர்ப்பிக்கிறேன்.',
  };
}

/**
 * Triggers visible document or receipt download action on the page
 * @returns {{ success: boolean, messageEn: string, messageTa: string }}
 */
export function triggerDocumentDownload() {
  // Find download buttons on the page
  const downloadBtns = Array.from(document.querySelectorAll('button')).filter((btn) => {
    if (btn.closest('.cv-fixed-container')) return false;
    const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    return (
      text.includes('get file') ||
      text.includes('download official receipt') ||
      text.includes('download receipt') ||
      text.includes('download image') ||
      text.includes('download certificate') ||
      text.includes('download')
    );
  });

  if (downloadBtns.length > 0) {
    downloadBtns[0].click();
    return {
      success: true,
      messageEn: 'Downloading the document.',
      messageTa: 'ஆவணத்தை பதிவிறக்குகிறேன்.',
    };
  }

  return {
    success: false,
    messageEn: 'No downloadable document was found on this page.',
    messageTa: 'இந்தப் பக்கத்தில் பதிவிறக்கக்கூடிய ஆவணம் எதுவும் இல்லை.',
  };
}

/**
 * Toggles "New Request" or "New Ticket" form toggle button if visible
 * @returns {boolean}
 */
export function toggleNewItemForm() {
  const toggleBtn = Array.from(document.querySelectorAll('button')).find((btn) => {
    if (btn.closest('.cv-fixed-container')) return false;
    const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    return (
      text.includes('+ new request') ||
      text.includes('+ new ticket') ||
      text.includes('+ new booking') ||
      text.includes('new request')
    );
  });

  if (toggleBtn) {
    toggleBtn.click();
    return true;
  }
  return false;
}

/**
 * Focuses a specific form input field by human label / name / placeholder
 * @param {string} fieldName Target field type (name, date, intention, subject, etc.)
 * @returns {{ success: boolean, label: string }}
 */
export function focusFormField(fieldName) {
  if (!fieldName) return { success: false, label: '' };
  const clean = fieldName.toLowerCase();

  const selectors = [];
  if (clean.includes('name') || clean.includes('பெயர்')) {
    selectors.push('input[name*="name" i]', 'input[id*="name" i]', 'input[placeholder*="name" i]', 'input[placeholder*="பெயர்" i]');
  } else if (clean.includes('date') || clean.includes('தேதி')) {
    selectors.push('input[type="date"]', 'input[name*="date" i]', 'input[id*="date" i]', 'input[placeholder*="date" i]');
  } else if (clean.includes('intention') || clean.includes('கருத்து')) {
    selectors.push('textarea[name*="intention" i]', 'input[name*="intention" i]', 'textarea[placeholder*="intention" i]');
  } else if (clean.includes('subject') || clean.includes('தலைப்பு')) {
    selectors.push('input[name*="subject" i]', 'input[id*="subject" i]', 'input[placeholder*="subject" i]');
  } else if (clean.includes('message') || clean.includes('description') || clean.includes('செய்தி')) {
    selectors.push('textarea[name*="message" i]', 'textarea[name*="desc" i]', 'textarea');
  } else if (clean.includes('phone') || clean.includes('mobile') || clean.includes('தொலைபேசி')) {
    selectors.push('input[type="tel"]', 'input[name*="phone" i]', 'input[name*="mobile" i]');
  } else if (clean.includes('email') || clean.includes('மின்னஞ்சல்')) {
    selectors.push('input[type="email"]', 'input[name*="email" i]');
  } else if (clean.includes('amount') || clean.includes('தொகை')) {
    selectors.push('input[name*="amount" i]', 'input[type="number"]');
  }

  // Fallback: look through all inputs/textareas
  selectors.push('input:not([type="hidden"])', 'textarea', 'select');

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      return { success: true, label: fieldName };
    }
  }

  return { success: false, label: fieldName };
}

/**
 * Returns spoken guidance on what fields are needed on the active page form
 * @param {string} pathname
 * @param {boolean} isTamil
 * @returns {string}
 */
export function getFormFieldsGuidance(pathname = '', isTamil = false) {
  if (pathname.includes('/booking')) {
    return isTamil
      ? 'திருப்பலி முன்பதிவு படிவத்தில்: நீங்கள் திருப்பலி கருத்து, யாருக்காக திருப்பலி ஒப்புக்கொடுக்கப்படுகிறது என்ற பெயர், மற்றும் விரும்பிய தேதியை வழங்க வேண்டும்.'
      : 'On the Book a Mass form, you’ll need to provide the Mass intention, the name or family for whom the Mass is offered, and the desired date.';
  }

  if (pathname.includes('/documents')) {
    return isTamil
      ? 'ஆவணக் கோரிக்கை படிவத்தில்: நீங்கள் ஞானஸ்நானம் அல்லது திருமண சான்றிதழ் போன்ற ஆவண வகையைத் தேர்ந்தெடுத்து தேவையான விவரங்களை உள்ளிட வேண்டும்.'
      : 'On the Document Request form, you’ll need to select the certificate type such as Baptism or Marriage, and enter the applicant details.';
  }

  if (pathname.includes('/tickets')) {
    return isTamil
      ? 'உதவி டிக்கெட் படிவத்தில்: நீங்கள் ஒரு தலைப்பு மற்றும் உங்கள் உதவி கோரிக்கையின் விவரங்களை உள்ளிட வேண்டும்.'
      : 'On the Support Ticket form, you’ll need to enter a subject and a description of your issue or request.';
  }

  if (pathname.includes('/prayer')) {
    return isTamil
      ? 'ஜெப வேண்டுதல் படிவத்தில்: நீங்கள் உங்கள் பெயர், தொலைபேசி எண் மற்றும் ஜெபக் குறிப்பை உள்ளிட வேண்டும்.'
      : 'On the Prayer Request form, you’ll need to enter your name, contact number, and your prayer intention.';
  }

  return isTamil
    ? 'இந்தப் படிவத்தில் தேவையான அனைத்து விவரங்களையும் நிரப்பி சமர்ப்பிக்கலாம்.'
    : 'You will need to provide all required fields on this form before submitting.';
}

/**
 * Controls visible/rendered audio elements or players (Devotional songs / Rosary)
 * @param {'play' | 'pause' | 'resume' | 'stop'} action
 * @returns {{ success: boolean, messageEn: string, messageTa: string }}
 */
export function controlAudioPlayer(action) {
  const audio = document.querySelector('audio');
  const playPauseBtn = document.querySelector('button[aria-label*="play" i], button[aria-label*="pause" i], button.song-play-btn');

  if (action === 'play' || action === 'resume') {
    if (audio) {
      audio.play().catch(() => {});
      return { success: true, messageEn: 'Playing the devotional song.', messageTa: 'பக்திப் பாடலை இயக்குகிறேன்.' };
    }
    if (playPauseBtn) {
      playPauseBtn.click();
      return { success: true, messageEn: 'Playing devotional song.', messageTa: 'பக்திப் பாடலை இயக்குகிறேன்.' };
    }
  }

  if (action === 'pause') {
    if (audio && !audio.paused) {
      audio.pause();
      return { success: true, messageEn: 'Paused the song.', messageTa: 'பாடல் இடைநிறுத்தப்பட்டது.' };
    }
    if (playPauseBtn) {
      playPauseBtn.click();
      return { success: true, messageEn: 'Paused the song.', messageTa: 'பாடல் இடைநிறுத்தப்பட்டது.' };
    }
  }

  if (action === 'stop') {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      return { success: true, messageEn: 'Stopped the song.', messageTa: 'பாடல் நிறுத்தப்பட்டது.' };
    }
  }

  return {
    success: false,
    messageEn: 'No active devotional song player was found on this page.',
    messageTa: 'இந்தப் பக்கத்தில் இசைப்பான் எதுவும் காணப்படவில்லை.',
  };
}

/**
 * Scans the active page for pending bookings or tickets
 * @param {boolean} isTamil
 * @returns {{ hasPending: boolean, description: string }}
 */
export function getPendingItemDetails(isTamil = false) {
  // Look for elements with "Pending" or "காத்திருக்கிறது"
  const badges = Array.from(document.querySelectorAll('.badge, span, p')).filter((el) => {
    const text = (el.innerText || '').trim().toLowerCase();
    return text === 'pending' || text.includes('pending') || text.includes('காத்திருக்கிறது');
  });

  if (badges.length > 0) {
    const parentCard = badges[0].closest('.card, .church-card, tr, .glass-card') || badges[0].parentElement;
    const cardText = (parentCard?.innerText || '').replace(/\s+/g, ' ').slice(0, 100);

    return {
      hasPending: true,
      description: isTamil
        ? `உங்கள் நிலுவையில் உள்ள பதிவு: ${cardText}.`
        : `Your pending item is: ${cardText}.`,
    };
  }

  return {
    hasPending: false,
    description: isTamil
      ? 'தற்போது நிலுவையில் உள்ள பதிவுகள் எதுவும் இந்தப் பக்கத்தில் இல்லை.'
      : 'You have no pending items currently visible on this page.',
  };
}

/**
 * Opens or clicks the first pending item visible on the screen
 * @returns {boolean}
 */
export function openPendingItem() {
  const badges = Array.from(document.querySelectorAll('.badge, span, p')).filter((el) => {
    const text = (el.innerText || '').trim().toLowerCase();
    return text === 'pending' || text.includes('pending') || text.includes('காத்திருக்கிறது');
  });

  if (badges.length > 0) {
    const card = badges[0].closest('.card, .church-card, tr, .glass-card') || badges[0];
    const clickTarget = card.querySelector('button, a') || card;
    clickTarget.click();
    return true;
  }
  return false;
}
