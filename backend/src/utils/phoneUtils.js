/**
 * Canonical Phone Identity & E.164 Normalization Utility
 * 
 * Enforces strict, canonical phone identity matching to eliminate country code
 * collisions, bypasses, and format divergence across WhatsApp and Web channels.
 * 
 * Supports:
 * - "+91 98765 43210"  -> "+919876543210"
 * - "+919876543210"    -> "+919876543210"
 * - "919876543210"     -> "+919876543210"
 * - "09876543210"      -> "+919876543210"
 * - "9876543210"       -> "+919876543210"
 * - International (e.g. "+1 555 123 4567") -> "+15551234567"
 */

function normalizeToE164(phone, defaultCountry = '91') {
  if (!phone && phone !== 0) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  // If already starts with '+'
  if (raw.startsWith('+')) {
    const digitsOnly = raw.slice(1).replace(/\D/g, '');
    if (!digitsOnly) return '';
    return `+${digitsOnly}`;
  }

  // Strip all non-digits
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // Case: International '00' prefix (e.g. 00919876543210 -> +919876543210)
  if (digits.startsWith('00') && digits.length > 4) {
    return `+${digits.slice(2)}`;
  }

  // Case: Standard Indian trunk prefix '0' + 10 digits (e.g. 09876543210 -> +919876543210)
  if (digits.startsWith('0') && digits.length === 11) {
    return `+${defaultCountry}${digits.slice(1)}`;
  }

  // Case: 10-digit national number (e.g. 9876543210 -> +919876543210)
  if (digits.length === 10) {
    return `+${defaultCountry}${digits}`;
  }

  // Case: 12 digits starting with '91' (e.g. 919876543210 -> +919876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // Default: prepend '+' to digits
  return `+${digits}`;
}

/**
 * Returns canonical lookup keys and MongoDB query matcher for resilient matching.
 */
function getPhoneLookupKeys(rawPhone, defaultCountry = '91') {
  const e164 = normalizeToE164(rawPhone, defaultCountry);
  const rawDigits = e164 ? e164.replace(/\D/g, '') : '';
  const last10 = rawDigits.slice(-10);

  const orConditions = [];
  if (e164) orConditions.push({ phoneNumber: e164 });
  if (rawDigits) orConditions.push({ phoneNumber: rawDigits });
  if (last10) {
    orConditions.push({ phoneNumber: last10 });
    orConditions.push({ phoneNumber: new RegExp(last10 + '$') });
  }

  return {
    e164,
    rawDigits,
    last10,
    dbOrQuery: orConditions.length > 0 ? orConditions : [{ phoneNumber: '__NONE__' }]
  };
}

/**
 * Compare two phone numbers for identity equality after canonical normalization.
 */
function isSamePhoneIdentity(phoneA, phoneB, defaultCountry = '91') {
  const a = normalizeToE164(phoneA, defaultCountry);
  const b = normalizeToE164(phoneB, defaultCountry);
  if (!a || !b) return false;
  return a === b;
}

module.exports = {
  normalizeToE164,
  getPhoneLookupKeys,
  isSamePhoneIdentity
};
