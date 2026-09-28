/**
 * User Language Preference Normalization and Resolution
 * 
 * Accurately determines a user's Daily Catholic Content language preference:
 * - 'ta' (Tamil)
 * - 'en' (English)
 * - 'both' (Bilingual Tamil + English)
 * 
 * IMPORTANT:
 * - Does NOT use session.botLanguage (which is the general bot menu interface language).
 * - Strictly respects the Daily Catholic Content language preference chosen during onboarding.
 */

/**
 * Normalizes any string representation of language into 'ta', 'en', or 'both'.
 * 
 * Supported inputs:
 * - 'ta', 'en', 'both'
 * - 'tamil', 'english', 'Tamil', 'English', 'Both', 'both'
 * - '1', '2', '3'
 * - 'ta-en', 'en-ta', 'all'
 * - Default: 'ta'
 */
function normalizeContentLanguage(lang) {
  if (!lang) return 'ta';
  const clean = String(lang).trim().toLowerCase();

  if (
    clean === 'both' ||
    clean === '3' ||
    clean === 'all' ||
    clean.includes('both') ||
    clean.includes('ta-en') ||
    clean.includes('en-ta') ||
    (clean.includes('ta') && clean.includes('en')) ||
    (clean.includes('tamil') && clean.includes('english'))
  ) {
    return 'both';
  }

  if (
    clean === 'en' ||
    clean === '2' ||
    clean === 'english' ||
    clean.startsWith('en')
  ) {
    return 'en';
  }

  if (clean === 'ml' || clean.includes('malayalam')) {
    return 'ml';
  }

  // Default to Tamil
  return 'ta';
}

/**
 * Resolves the Daily Catholic Content language for a user or session.
 * 
 * Priority order:
 * 1. userOrSession.language (set on BotSession during Step 6 of onboarding)
 * 2. userOrSession.mass_reflection_language (user profile field)
 * 3. userOrSession.settings?.notifications?.mass_reflection_language
 * 4. userOrSession.preferredLanguage
 * 5. Default: 'ta'
 * 
 * Explicitly ignores session.botLanguage so general bot language does not override
 * spiritual content language.
 */
function getUserDailyContentLanguage(userOrSession) {
  if (!userOrSession) return 'ta';

  // 1. WhatsApp BotSession stores Daily Catholic Content language in session.language
  if (userOrSession.language) {
    return normalizeContentLanguage(userOrSession.language);
  }

  // 2. User website profile fields
  if (userOrSession.mass_reflection_language) {
    return normalizeContentLanguage(userOrSession.mass_reflection_language);
  }

  if (userOrSession.settings?.notifications?.mass_reflection_language) {
    return normalizeContentLanguage(userOrSession.settings.notifications.mass_reflection_language);
  }

  if (userOrSession.preferredLanguage) {
    return normalizeContentLanguage(userOrSession.preferredLanguage);
  }

  return 'ta';
}

module.exports = {
  normalizeContentLanguage,
  getUserDailyContentLanguage
};
