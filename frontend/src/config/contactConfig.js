/**
 * Frontend Public Contact & Social Configuration
 * 
 * Manages approved, public church contact information displayed on the website.
 * Reads from Vite environment variables (VITE_*) with dynamic backend settings fallback.
 * 
 * IMPORTANT: Never put private administrator contacts or secret keys in this file.
 */

let dynamicSettings = {};

export function updateContactSettings(settings = {}) {
  if (typeof settings === 'object' && settings !== null) {
    dynamicSettings = { ...dynamicSettings, ...settings };
  }
}

export function getChurchEmail() {
  return (
    dynamicSettings.churchEmail ||
    dynamicSettings.contactEmail ||
    dynamicSettings.email ||
    import.meta.env.VITE_CHURCH_EMAIL ||
    ''
  );
}

export function getChurchPhone() {
  return (
    dynamicSettings.churchPhone ||
    dynamicSettings.contactPhone ||
    dynamicSettings.phone ||
    import.meta.env.VITE_CHURCH_PHONE ||
    ''
  );
}

export function getParishOfficePhone() {
  return (
    dynamicSettings.parishOfficePhone ||
    dynamicSettings.officePhone ||
    import.meta.env.VITE_PARISH_OFFICE_PHONE ||
    ''
  );
}

export function getWhatsAppNumber() {
  const raw = (
    dynamicSettings.whatsappBotPhoneNumber ||
    dynamicSettings.whatsapp_bot_phone_number ||
    import.meta.env.VITE_WHATSAPP_BOT_NUMBER ||
    ''
  );
  return String(raw).replace(/\D/g, '');
}

export function getWhatsAppChannelUrl() {
  return (
    dynamicSettings.whatsappChannelUrl ||
    dynamicSettings.whatsapp_channel_url ||
    import.meta.env.VITE_WHATSAPP_CHANNEL_URL ||
    ''
  );
}

export default {
  getChurchEmail,
  getChurchPhone,
  getParishOfficePhone,
  getWhatsAppNumber,
  getWhatsAppChannelUrl,
  updateContactSettings
};
