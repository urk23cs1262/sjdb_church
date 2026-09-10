/**
 * Church Mass Intention & Prayer Request Categories
 * Provides language-independent category IDs with English and Tamil translations.
 */

export const CHURCH_MASS_INTENTION_CATEGORIES = [
  {
    id: 'thanksgiving',
    en: 'In Thanksgiving for Blessings Received',
    ta: 'பெற்ற நன்மைகளுக்கு நன்றியாக'
  },
  {
    id: 'birthday_wedding_anniversary',
    en: 'For Birthday / Wedding Anniversary',
    ta: 'பிறந்த நாள் / திருமண நாள் நன்றியாக'
  },
  {
    id: 'birthday',
    en: 'Birthday',
    ta: 'பிறந்த நாள்',
    isSubOption: true,
    parentId: 'birthday_wedding_anniversary'
  },
  {
    id: 'wedding_anniversary',
    en: 'Wedding Anniversary',
    ta: 'திருமண நாள்',
    isSubOption: true,
    parentId: 'birthday_wedding_anniversary'
  },
  {
    id: 'good_health',
    en: 'For Everyone to Live in Good Health',
    ta: 'அனைவரும் நற்சுகத்துடன் வாழ'
  },
  {
    id: 'children_knowledge_wisdom',
    en: 'For Children to Grow in Knowledge and Wisdom',
    ta: 'பிள்ளைகள் அறிவிலும் ஞானத்திலும் வளர'
  },
  {
    id: 'exam_success',
    en: 'For Success in Examinations',
    ta: 'தேர்வில் வெற்றி பெற'
  },
  {
    id: 'employment_job',
    en: 'For Employment / Job Opportunity',
    ta: 'வேலைவாய்ப்பு கிடைத்திட'
  },
  {
    id: 'abroad_military',
    en: 'For Those Living Abroad / Serving in the Military',
    ta: 'வெளிநாடு / இராணுவத்தில் உள்ளோருக்காக'
  },
  {
    id: 'living_abroad',
    en: 'Living Abroad',
    ta: 'வெளிநாட்டில் உள்ளோருக்காக',
    isSubOption: true,
    parentId: 'abroad_military'
  },
  {
    id: 'military_service',
    en: 'Serving in the Military',
    ta: 'இராணுவத்தில் உள்ளோருக்காக',
    isSubOption: true,
    parentId: 'abroad_military'
  },
  {
    id: 'family_peace_harmony',
    en: 'For Peace and Harmony in the Family',
    ta: 'குடும்பத்தில் அமைதியும் சமாதானமும் நிலவ'
  },
  {
    id: 'family_grace',
    en: 'For God’s Grace upon the Family',
    ta: 'குடும்பத்திற்கு இறையருள் கிடைத்திட'
  },
  {
    id: 'desired_intentions',
    en: 'For the Fulfilment of Desired Intentions',
    ta: 'நினைத்த காரியங்கள் நிறைவேற'
  },
  {
    id: 'other_intentions',
    en: 'Other Intentions',
    ta: 'இதர கருத்துக்கள்'
  }
];

export const HOME_PRAYER_CATEGORIES = [
  {
    id: 'general_prayer',
    en: 'General Prayer Request',
    ta: 'பொதுவான ஜெப விண்ணப்பம்'
  },
  {
    id: 'home_blessing',
    en: 'Home Blessing Prayer',
    ta: 'இல்ல ஆசீர்வாத ஜெபம்'
  },
  {
    id: 'healing_health',
    en: 'Healing & Good Health',
    ta: 'உடல்நலம் & சுகமளிக்கும் ஜெபம்'
  },
  {
    id: 'special_housewarming',
    en: 'Special Occasion: Housewarming',
    ta: 'புதுமனை புகுவிழா ஜெபம்'
  },
  {
    id: 'special_wedding_anniversary',
    en: 'Special Occasion: Wedding Anniversary',
    ta: 'திருமண நாள் ஜெபம்'
  },
  {
    id: 'special_birthday',
    en: 'Special Occasion: Birthday',
    ta: 'பிறந்த நாள் ஜெபம்'
  },
  {
    id: 'personal_others',
    en: 'Others',
    ta: 'இதர வேண்டுதல்கள்'
  }
];

// Map of all categories by ID for quick lookup
const ALL_CATEGORIES_MAP = new Map();
[...CHURCH_MASS_INTENTION_CATEGORIES, ...HOME_PRAYER_CATEGORIES].forEach(item => {
  ALL_CATEGORIES_MAP.set(item.id, item);
});

// Legacy string to Category ID / translations fallback
const LEGACY_MAPPING = {
  'Thanksgiving': { en: 'In Thanksgiving for Blessings Received', ta: 'பெற்ற நன்மைகளுக்கு நன்றியாக' },
  'Birthday Blessing': { en: 'Birthday', ta: 'பிறந்த நாள்' },
  'Wedding Anniversary': { en: 'Wedding Anniversary', ta: 'திருமண நாள்' },
  'Good Health & Healing': { en: 'For Everyone to Live in Good Health', ta: 'அனைவரும் நற்சுகத்துடன் வாழ' },
  'Safe Journey': { en: 'Safe Journey', ta: 'பாதுகாப்பான பயணம்' },
  'Exam Success': { en: 'For Success in Examinations', ta: 'தேர்வில் வெற்றி பெற' },
  'For the Souls of the Departed': { en: 'For the Souls of the Departed', ta: 'மரித்த ஆன்மாக்களுக்காக' },
  'RIP Anniversary Mass': { en: 'RIP Anniversary Mass', ta: 'நினைவுத் திருப்பலி' },
  'Special Intention': { en: 'Special Intention', ta: 'சிறப்புக் கருத்து' },
  'General Prayer Request': { en: 'General Prayer Request', ta: 'பொதுவான ஜெப விண்ணப்பம்' },
  'Home Blessing Prayer': { en: 'Home Blessing Prayer', ta: 'இல்ல ஆசீர்வாத ஜெபம்' },
  'Healing & Good Health': { en: 'Healing & Good Health', ta: 'உடல்நலம் & சுகமளிக்கும் ஜெபம்' },
  'Special Occasion: Housewarming': { en: 'Special Occasion: Housewarming', ta: 'புதுமனை புகுவிழா ஜெபம்' },
  'Special Occasion: Wedding Anniversary': { en: 'Special Occasion: Wedding Anniversary', ta: 'திருமண நாள் ஜெபம்' },
  'Special Occasion: Birthday': { en: 'Special Occasion: Birthday', ta: 'பிறந்த நாள் ஜெபம்' },
  'Others': { en: 'Other Intentions', ta: 'இதர கருத்துக்கள்' },
  'Confession Request': { en: 'Confession Request', ta: 'பாவசங்கீர்த்தன விண்ணப்பம்' }
};

/**
 * Get human-readable localized label for an intention category ID or legacy string
 * @param {string} categoryId - e.g. 'thanksgiving', 'good_health', or legacy 'Thanksgiving'
 * @param {string} lang - 'en' or 'ta'
 * @returns {string} Localized display text
 */
export function getIntentionCategoryLabel(categoryId, lang = 'en') {
  if (!categoryId) return '';
  const isTa = String(lang).toLowerCase().startsWith('ta');

  // Direct lookup by category ID
  if (ALL_CATEGORIES_MAP.has(categoryId)) {
    const item = ALL_CATEGORIES_MAP.get(categoryId);
    return isTa ? item.ta : item.en;
  }

  // Legacy fallback
  if (LEGACY_MAPPING[categoryId]) {
    return isTa ? LEGACY_MAPPING[categoryId].ta : LEGACY_MAPPING[categoryId].en;
  }

  // Default return original string
  return categoryId;
}

export default {
  CHURCH_MASS_INTENTION_CATEGORIES,
  HOME_PRAYER_CATEGORIES,
  getIntentionCategoryLabel
};
