const sendSMS = async (to, message) => {
  console.log(` [Twilio Disabled] SMS to ${to} skipped: ${message.slice(0, 50)}...`);
  return { success: true, sid: 'mock_sms_disabled_sid' };
};

const sendWhatsApp = async (to, body, mediaUrl) => {
  console.log(` [Twilio Disabled] WhatsApp to ${to} skipped: ${body.slice(0, 50)}...`);
  return { success: true, sid: 'mock_whatsapp_disabled_sid' };
};

module.exports = { sendSMS, sendWhatsApp };
