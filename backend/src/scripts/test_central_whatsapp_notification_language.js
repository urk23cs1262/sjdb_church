/**
 * Verification Test Suite: WhatsApp Notification Language Architecture
 * 
 * Tests the fundamental architectural rule:
 * - The user's saved `botLanguage` is the SINGLE SOURCE OF TRUTH for every WhatsApp notification.
 * - Dynamic data (dates, times, venues, URLs, phones, amounts, receipts, OTPs) is 100% preserved.
 * - `botLanguage` is strictly separated from `dailyCatholicLanguage`.
 */

const assert = require('assert');
const {
  translateNotification,
  resolveUserBotLanguage,
  maskDynamicData,
  unmaskDynamicData,
  sendWhatsAppNotification
} = require('../services/whatsAppNotificationService');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING WHATSAPP NOTIFICATION BOT LANGUAGE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // ── TEST 1: Dynamic Data Masking & Unmasking ────────────────────────────────
  test('Masking preserves URLs, amounts, receipts, OTPs, dates, and times', () => {
    const raw = `Event: Feast Mass
Date: 15 October 2026
Time: 10:30 AM
Amount: ₹1,500
Receipt: REC-2026-888
OTP: 981240
Portal: https://st-jb-church.vercel.app/events`;

    const { tokenized, tokens } = maskDynamicData(raw);
    assert(tokens.length >= 6, `Expected at least 6 tokens, got ${tokens.length}`);
    
    // Test that unmasking recovers original string
    const recovered = unmaskDynamicData(tokenized, tokens);
    assert.strictEqual(recovered, raw, 'Unmasking must perfectly recover original text');
  });

  // ── TEST 2: Admin English -> User Tamil Translation ─────────────────────────
  await asyncTest('User botLanguage=tamil receives Tamil for English admin content', async () => {
    const englishMsg = 'Holy Mass will be held tomorrow at 10:30 AM.';
    const result = await translateNotification(englishMsg, 'tamil');
    
    assert(/[\u0B80-\u0BFF]/.test(result), 'Result must contain Tamil characters');
    assert(result.includes('10:30 AM') || result.includes('10:30 am'), 'Time must be preserved');
    console.log('   Result:', result);
  });

  // ── TEST 3: Admin Tamil -> User English Translation ─────────────────────────
  await asyncTest('User botLanguage=english receives English for Tamil admin content', async () => {
    const tamilMsg = 'நாளை காலை 10:30 மணிக்கு திருப்பலி நடைபெறும்.';
    const result = await translateNotification(tamilMsg, 'english');
    
    assert(/mass|holy mass/i.test(result), 'Result should translate to Mass');
    assert(!/[\u0B80-\u0BFF]/.test(result), 'Result should not contain Tamil characters');
    assert(result.includes('10:30'), 'Time must be preserved');
    console.log('   Result:', result);
  });

  // ── TEST 4: User Both receives English + Tamil ──────────────────────────────
  await asyncTest('User botLanguage=both receives both English and Tamil', async () => {
    const msg = 'Church will remain closed tomorrow due to maintenance.';
    const result = await translateNotification(msg, 'both');
    
    assert(result.includes('*English:*'), 'Result must include English section');
    assert(result.includes('*தமிழ்:*'), 'Result must include Tamil section');
    assert(/[\u0B80-\u0BFF]/.test(result), 'Result must contain Tamil characters');
    console.log('   Result:\n' + result);
  });

  // ── TEST 5: Donation Receipt with Dynamic Data ──────────────────────────────
  await asyncTest('Donation notification preserves amount, receipt ID, payment ref, and date', async () => {
    const donationMsg = `*ST. JOHN DE BRITTO CHURCH*

Dear *John Doe*,

Thank you for your generous donation of *₹5,000* towards *Parish Feast*.

*Receipt No:* REC-2026-999
*Payment ID:* TXN-884920
*Date:* 15 October 2026

May Lord Jesus and St. John de Britto bless you abundantly.`;

    const tamilResult = await translateNotification(donationMsg, 'tamil');
    assert(tamilResult.includes('₹5,000'), 'Amount ₹5,000 must be preserved');
    assert(tamilResult.includes('REC-2026-999'), 'Receipt No REC-2026-999 must be preserved');
    assert(tamilResult.includes('TXN-884920'), 'Payment ID TXN-884920 must be preserved');
    assert(tamilResult.includes('15 October 2026'), 'Date 15 October 2026 must be preserved');
    assert(/[\u0B80-\u0BFF]/.test(tamilResult), 'Result must be translated to Tamil');
    console.log('   Donation Tamil:\n' + tamilResult);
  });

  // ── TEST 6: OTP Notification Preservation ───────────────────────────────────
  await asyncTest('OTP notification preserves 6-digit OTP code and expiry', async () => {
    const otpMsg = `*Account Verification Required*

Dear *Parishioner*,

Your St. John De Britto Church account requires verification.

*Your OTP is: 481920*

⏱️ OTP expires in 5 minutes.
⚠️ Do not share this OTP with anyone.

_St. John de Britto Church, Kalayarkoil_`;

    const tamilResult = await translateNotification(otpMsg, 'tamil');
    assert(tamilResult.includes('481920'), 'OTP code 481920 must be preserved');
    assert(/[\u0B80-\u0BFF]/.test(tamilResult), 'Result must be translated to Tamil');
    console.log('   OTP Tamil:\n' + tamilResult);
  });

  // ── TEST 7: Architectural Separation Test ───────────────────────────────────
  await asyncTest('Architectural Separation: botLanguage vs dailyCatholicLanguage', async () => {
    const mockUser = {
      phone: '9876543210',
      botLanguage: 'tamil',
      dailyCatholicLanguage: 'english',
      dailyCatholicSetupCompleted: true,
      dailyCatholicSubscribed: true
    };

    // Notification service resolves botLanguage for ALL notifications
    const resolvedLang = await resolveUserBotLanguage(mockUser);
    assert.strictEqual(resolvedLang, 'tamil', 'WhatsApp notifications must use botLanguage (tamil)');
    assert.strictEqual(mockUser.dailyCatholicLanguage, 'english', 'dailyCatholicLanguage remains independent');
  });

  // ── TEST 8: Full dispatch to Tamil user translates English message ──────────
  await asyncTest('sendWhatsAppNotification dispatches translated Tamil message to Tamil user', async () => {
    const wa = require('../bot/whatsapp');
    const origSend = wa.sendWhatsAppMessage;
    let dispatchedPhone = null;
    let dispatchedText = null;

    wa.sendWhatsAppMessage = async (phone, text) => {
      dispatchedPhone = phone;
      dispatchedText = text;
      return true;
    };

    try {
      const tamilUser = { phone: '9876543210', botLanguage: 'tamil' };
      const adminNotice = {
        title: 'Parish Announcement',
        message: 'Church will remain closed tomorrow due to maintenance.'
      };

      const result = await sendWhatsAppNotification(tamilUser, adminNotice);
      assert.strictEqual(result.success, true);
      assert.strictEqual(dispatchedPhone, '9876543210');
      assert(/[\u0B80-\u0BFF]/.test(dispatchedText), 'Dispatched message must be in Tamil');
      console.log('   Dispatched to Tamil user:\n' + dispatchedText);
    } finally {
      wa.sendWhatsAppMessage = origSend;
    }
  });

  // ── TEST 9: Full dispatch to English user translates Tamil message ──────────
  await asyncTest('sendWhatsAppNotification dispatches translated English message to English user', async () => {
    const wa = require('../bot/whatsapp');
    const origSend = wa.sendWhatsAppMessage;
    let dispatchedPhone = null;
    let dispatchedText = null;

    wa.sendWhatsAppMessage = async (phone, text) => {
      dispatchedPhone = phone;
      dispatchedText = text;
      return true;
    };

    try {
      const englishUser = { phone: '9876543210', botLanguage: 'english' };
      const adminNotice = {
        title: 'திருப்பலி அறிவிப்பு',
        message: 'நாளை காலை 10:30 மணிக்கு திருப்பலி நடைபெறும்.'
      };

      const result = await sendWhatsAppNotification(englishUser, adminNotice);
      assert.strictEqual(result.success, true);
      assert.strictEqual(dispatchedPhone, '9876543210');
      assert(!/[\u0B80-\u0BFF]/.test(dispatchedText), 'Dispatched message must be in English');
      assert(/mass/i.test(dispatchedText), 'Dispatched message must translate to English');
      console.log('   Dispatched to English user:\n' + dispatchedText);
    } finally {
      wa.sendWhatsAppMessage = origSend;
    }
  });

  // ── TEST 10: Full dispatch to Both user sends bilingual message ─────────────
  await asyncTest('sendWhatsAppNotification dispatches bilingual message to Both user', async () => {
    const wa = require('../bot/whatsapp');
    const origSend = wa.sendWhatsAppMessage;
    let dispatchedPhone = null;
    let dispatchedText = null;

    wa.sendWhatsAppMessage = async (phone, text) => {
      dispatchedPhone = phone;
      dispatchedText = text;
      return true;
    };

    try {
      const bothUser = { phone: '9876543210', botLanguage: 'both' };
      const adminNotice = 'Church will remain closed tomorrow due to maintenance.';

      const result = await sendWhatsAppNotification(bothUser, adminNotice);
      assert.strictEqual(result.success, true);
      assert.strictEqual(dispatchedPhone, '9876543210');
      assert(dispatchedText.includes('*English:*'), 'Must contain English section');
      assert(dispatchedText.includes('*தமிழ்:*'), 'Must contain Tamil section');
      console.log('   Dispatched to Both user:\n' + dispatchedText);
    } finally {
      wa.sendWhatsAppMessage = origSend;
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
