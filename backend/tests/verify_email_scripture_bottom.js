const { generateDailyNotificationHtml } = require('../src/templates/dailyNotificationEmail');
const { getFreshBibleVerse, formatEmailVerseCard, injectFreshBibleVerseIntoHtml } = require('../src/services/emailVerseService');

async function testAll() {
  console.log('--- 1. Testing Daily Catholic Notification Email ---');
  const mockDaily = {
    formattedDate: '30 September 2026',
    formattedDateTa: '30 செப்டம்பர் 2026',
    bible: {
      ref: 'Psalm 63:1',
      english: 'You, God, are my God, earnestly I seek you; I thirst for you, my whole being longs for you.',
      tamil: 'தேவனே, நீரே என் தேவன்; அதிகாலையிலே உம்மைத் தேடுகிறேன்; உமக்காக என் ஆத்துமா தாகமாயிருக்கிறது; உமக்காக என் மாம்சம் இச்சிக்கிறது.'
    },
    massReadings: {
      tamil: { title: 'புனித ஜெரோம் நினைவுத் திருநாள்', readings: [{ type: 'முதல் வாசகம்', reference: 'யோபு 9:1-12, 14-16', text: 'யோபு கூறியது...' }] },
      english: { title: 'Memorial of Saint Jerome', readings: [{ type: 'First Reading', reference: 'Job 9:1-12, 14-16', text: 'Job answered...' }] }
    },
    reflection: {
      tamil: 'இன்றைய சிந்தனை: இறைவார்த்தை நம் வாழ்வின் ஒளி.',
      english: 'Today Reflection: The living word of God guides our steps.'
    },
    saint: {
      nameEnglish: 'Saint Jerome, Priest and Doctor of the Church',
      nameTamil: 'புனித ஜெரோம், மறைவல்லுநர்',
      descriptionEnglish: 'Ignorance of Scripture is ignorance of Christ.',
      descriptionTamil: 'திருவிவிலியத்தை அறியாதவர் கிறிஸ்துவை அறியாதவர்.'
    },
    readingsUrl: 'http://localhost:5173/daily'
  };

  const dailyHtml = generateDailyNotificationHtml({
    userName: 'John Doe',
    dailyContent: mockDaily,
    userLanguage: 'ta'
  });

  const processedDaily = await injectFreshBibleVerseIntoHtml(dailyHtml);

  // Check positions in order:
  // 1. Daily Bible verse (image + text)
  // 2. Daily Mass readings
  // 3. Today's reflection
  // 4. Saint of the day (image of the saint and about the saint)
  // 5. Button says Read on SJDB
  // 6. Holy Scripture
  const headerIdx = processedDaily.indexOf('ST. JOHN DE Britto CHURCH');
  const verseTopIdx = processedDaily.indexOf('DAILY BIBLE VERSE / இன்றைய இறைவார்த்தை');
  const readingsIdx = processedDaily.indexOf('DAILY MASS READINGS');
  const reflectionIdx = processedDaily.indexOf('இன்றைய சிந்தனை');
  const saintIdx = processedDaily.indexOf('SAINT OF THE DAY / இன்றைய புனிதர்');
  const ctaBtnIdx = processedDaily.indexOf('Read on SJDB');
  const scriptureIdx = processedDaily.indexOf('HOLY SCRIPTURE • Daily Scripture • Prayer');
  const footerIdx = processedDaily.indexOf('May God bless you and have a blessed day');

  console.log('Positions in Daily Email:');
  console.log('Header index:', headerIdx);
  console.log('Daily Bible Verse (top) index:', verseTopIdx);
  console.log('Readings index:', readingsIdx);
  console.log('Reflection index:', reflectionIdx);
  console.log('Saint index:', saintIdx);
  console.log('CTA Button (Read on SJDB) index:', ctaBtnIdx);
  console.log('Holy Scripture index:', scriptureIdx);
  console.log('Footer index:', footerIdx);

  const dailyCorrect = (headerIdx < verseTopIdx) &&
                       (verseTopIdx < readingsIdx) &&
                       (readingsIdx < reflectionIdx) &&
                       (reflectionIdx < saintIdx) &&
                       (saintIdx < ctaBtnIdx) &&
                       (ctaBtnIdx < scriptureIdx) &&
                       (scriptureIdx < footerIdx);
  console.log('Daily Email Order Correct (Header < Verse < Readings < Reflection < Saint < Button < Scripture < Footer):', dailyCorrect);

  const cardMatches = (processedDaily.match(/<!-- DYNAMIC BILINGUAL BIBLE VERSE CARD -->/g) || []).length;
  console.log('Dynamic Bible Verse Card Count (must be 1):', cardMatches);

  console.log('\n--- 2. Testing Request Notification Email (User & Admin) ---');
  const mockRequestHtml = `
  <div class="box">
    <div class="header"><h1>St. John de Britto Church</h1></div>
    <div class="content">
      <h2>Dear Parishioner</h2>
      <p>Your Mass Intention request has been approved.</p>
      <div class="card"><div class="row">Ref: MB-2026-588916</div></div>
      <div style="text-align:center;"><a href="http://localhost:5173/request" class="btn">👉 View Details →</a></div>
    </div>
    <div class="footer"><p>St. John de Britto Church, Kalayarkoil - 630551</p></div>
  </div>`;

  const processedReq = await injectFreshBibleVerseIntoHtml(mockRequestHtml);
  const reqHeader = processedReq.indexOf('St. John de Britto Church');
  const reqBtn = processedReq.indexOf('👉 View Details →');
  const reqScripture = processedReq.indexOf('HOLY SCRIPTURE • Daily Scripture • Prayer');
  const reqFooter = processedReq.indexOf('class="footer"');

  console.log('Request Notification Order Correct (Header < Btn < Scripture < Footer):',
    (reqHeader < reqBtn) && (reqBtn < reqScripture) && (reqScripture < reqFooter));

  console.log('\n--- 3. Testing Security Login Alert Email ---');
  const mockSecurityHtml = `
  <div class="wrapper">
    <div class="header"><h1>Security Alert</h1></div>
    <div class="body">
      <h2>New Login Detected</h2>
      <p>A login was recorded from Chrome on Windows.</p>
      <div style="text-align:center;"><a href="http://localhost:5173/report" class="btn">Report Unauthorized Access →</a></div>
      <p style="font-size:12px;">If this was you, no action needed.</p>
    </div>
    <!-- Footer -->
    <div style="background-color:#0f172a; padding:18px;">
      <p>St. John de Britto Church, Kalayarkoil</p>
    </div>
  </div>`;

  const processedSec = await injectFreshBibleVerseIntoHtml(mockSecurityHtml);
  const secHeader = processedSec.indexOf('Security Alert');
  const secBtn = processedSec.indexOf('Report Unauthorized Access →');
  const secScripture = processedSec.indexOf('HOLY SCRIPTURE • Daily Scripture • Prayer');
  const secFooter = processedSec.indexOf('<!-- Footer -->');

  console.log('Security Alert Order Correct (Header < Btn < Scripture < Footer):',
    (secHeader < secBtn) && (secBtn < secScripture) && (secScripture < secFooter));

  console.log('\n--- 4. Testing Admin Security Incident Email ---');
  const mockAdminHtml = `
  <div class="email-wrapper">
    <div class="header-box"><h1>St. John de Britto Church</h1><p>PARISH ADMIN</p></div>
    <div class="email-content">
      <h2>Admin Security Alert: Unauthorized Access Report</h2>
      <p>A member reported suspicious activity.</p>
      <div class="action-box"><a href="http://localhost:5173/admin" class="action-btn">Open Admin Center →</a></div>
    </div>
    <!-- FOOTER -->
    <div style="background-color:#0f172a;">
      <p>Automated Administrative Notification</p>
    </div>
  </div>`;

  const processedAdmin = await injectFreshBibleVerseIntoHtml(mockAdminHtml);
  const adminHeader = processedAdmin.indexOf('St. John de Britto Church');
  const adminBtn = processedAdmin.indexOf('Open Admin Center →');
  const adminScripture = processedAdmin.indexOf('HOLY SCRIPTURE • Daily Scripture • Prayer');
  const adminFooter = processedAdmin.indexOf('<!-- FOOTER -->');

  console.log('Admin Email Order Correct (Header < Btn < Scripture < Footer):',
    (adminHeader < adminBtn) && (adminBtn < adminScripture) && (adminScripture < adminFooter));

  console.log('\n--- 5. Testing Donation Receipt Email ---');
  const mockDonationHtml = `
  <div class="receipt-box">
    <table role="presentation" width="100%">
      <tr><td align="center"><h1>St. John de Britto Church</h1><p>Receipt</p></td></tr>
      <tr><td><p>Thank you for your donation of INR 1000.00.</p></td></tr>
      <!-- CONTACT DETAILS -->
      <tr><td><p>Contact Details: stjdbchurch@gmail.com</p></td></tr>
      <!-- FOOTER STATEMENT -->
      <tr><td align="center"><p>Computer Generated Receipt. SIGNATURE NOT REQUIRED</p></td></tr>
    </table>
  </div>`;

  const processedDonation = await injectFreshBibleVerseIntoHtml(mockDonationHtml);
  const donHeader = processedDonation.indexOf('St. John de Britto Church');
  const donContact = processedDonation.indexOf('Contact Details');
  const donScripture = processedDonation.indexOf('HOLY SCRIPTURE • Daily Scripture • Prayer');
  const donFooter = processedDonation.indexOf('<!-- FOOTER STATEMENT -->');

  console.log('Donation Receipt Order Correct (Header < Contact < Scripture < Footer):',
    (donHeader < donContact) && (donContact < donScripture) && (donScripture < donFooter));
}

testAll().catch(console.error);
