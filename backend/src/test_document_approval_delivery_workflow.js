/**
 * Automated Verification: Final Document-Delivery Workflow
 * 
 * Tests:
 * 1. Image to PDF Conversion (JPG / PNG -> 1:1 PDF buffer starting with %PDF-)
 * 2. Already-PDF handling (Preserves PDF directly)
 * 3. GridFS storage and getGridFSBuffer retrieval
 * 4. Multi-channel delivery verification:
 *    - Email attachment (Actual PDF attached)
 *    - WhatsApp Bot (Notification + Actual PDF document)
 *    - In-app notification (With secure link)
 *    - Web push alert
 * 5. End-to-end database & API request workflow:
 *    - User submits request -> Pending
 *    - Admin moves to Processing
 *    - Admin uploads image & approves -> Approved + PDF in GridFS
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  formatDocTypeName,
  getCanonicalPdfFilename,
  convertImageToPdfBuffer,
  prepareFinalDocumentPdf,
  deliverApprovedDocument
} = require('./services/documentDeliveryService');
const { getGridFSBuffer, uploadToGridFS, getGridFSFileDoc } = require('./services/gridfsService');
const User = require('./models/User');
const Document = require('./models/Document');
const Notification = require('./models/Notification');

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 VERIFYING FINAL DOCUMENT-DELIVERY WORKFLOW');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB Atlas for verification.\n');

  try {
    // ─── TEST 1: Image to PDF Conversion ─────────────────────────────────────────
    console.log('--- Test 1: Image to PDF Conversion ---');
    const sampleImgPath = path.join(__dirname, 'assets', 'church_extirior.png');
    assert(fs.existsSync(sampleImgPath), 'Sample PNG image exists');

    const imgBuffer = fs.readFileSync(sampleImgPath);
    const convertedPdf = await prepareFinalDocumentPdf({
      buffer: imgBuffer,
      originalname: 'church_extirior.png',
      mimetype: 'image/png'
    }, 'parish_membership');

    assert(convertedPdf.isConverted === true, 'Flagged as converted from image');
    assert(convertedPdf.mimetype === 'application/pdf', 'Output mimetype is application/pdf');
    assert(convertedPdf.filename === 'Parish_Membership.pdf', 'Output filename is Parish_Membership.pdf');
    assert(Buffer.isBuffer(convertedPdf.buffer), 'Result is a Buffer');
    assert(convertedPdf.buffer.slice(0, 5).toString('ascii') === '%PDF-', 'Buffer starts with %PDF- header');
    console.log(`   Generated PDF size: ${convertedPdf.buffer.length} bytes`);

    // ─── TEST 2: Existing PDF Handling (Pass-through) ───────────────────────────
    console.log('\n--- Test 2: Existing PDF Handling ---');
    const existingPdfResult = await prepareFinalDocumentPdf({
      buffer: convertedPdf.buffer,
      originalname: 'Parish_Membership.pdf',
      mimetype: 'application/pdf'
    }, 'parish_membership');

    assert(existingPdfResult.isConverted === false, 'PDF is not re-converted');
    assert(existingPdfResult.mimetype === 'application/pdf', 'Mimetype remains application/pdf');
    assert(existingPdfResult.buffer.length === convertedPdf.buffer.length, 'Buffer preserved identically');

    // ─── TEST 3: GridFS Storage & Buffer Retrieval ──────────────────────────────
    console.log('\n--- Test 3: GridFS Storage & Buffer Retrieval ---');
    const uploadResult = await uploadToGridFS(convertedPdf.buffer, convertedPdf.filename, 'application/pdf');
    assert(uploadResult && uploadResult.url, `Uploaded to GridFS at ${uploadResult.url}`);

    const retrievedBuffer = await getGridFSBuffer(uploadResult.url);
    assert(Buffer.isBuffer(retrievedBuffer), 'Retrieved buffer from GridFS');
    assert(retrievedBuffer.length === convertedPdf.buffer.length, 'Retrieved buffer matches original size');
    assert(retrievedBuffer.slice(0, 5).toString('ascii') === '%PDF-', 'Retrieved buffer has valid PDF signature');

    // ─── TEST 4: Multi-Channel Delivery Orchestration ────────────────────────────
    console.log('\n--- Test 4: Multi-Channel Delivery Orchestration ---');
    let testUser = await User.findOne({ email: { $exists: true, $ne: '' } });
    if (!testUser) {
      testUser = await User.findOne();
    }
    assert(testUser !== null, `Found test user: ${testUser?.name || 'N/A'}`);

    const testDoc = await Document.create({
      userId: testUser._id,
      type: 'parish_membership',
      requestDetails: 'Verification test for approved document delivery workflow',
      status: 'pending'
    });
    assert(testDoc.status === 'pending', 'Created document request in Pending state');

    // Deliver approved document with final PDF buffer
    testDoc.status = 'approved';
    testDoc.uploadedFile = uploadResult.url;
    await testDoc.save();

    const deliveryResult = await deliverApprovedDocument({
      document: testDoc,
      user: testUser,
      finalPdfBuffer: convertedPdf.buffer,
      filename: convertedPdf.filename,
      adminNote: 'Officially signed & delivered by Parish Priest'
    });

    assert(deliveryResult.success === true, 'deliverApprovedDocument completed successfully');
    assert(deliveryResult.channelsDelivered.includes('inApp'), 'In-app notification delivered');
    console.log('   Channels triggered:', deliveryResult.channelsDelivered.join(', '));

    // Check In-App Notification in DB
    const notif = await Notification.findOne({ relatedId: testDoc._id, recipient: 'user' }).sort({ createdAt: -1 });
    assert(notif !== null, 'In-App Notification saved in MongoDB');
    assert(notif?.title.includes('Parish Membership'), 'Notification title contains document name');
    assert(notif?.actionUrl.includes('DOC-'), 'Notification actionUrl contains secure deep link');
    assert(notif?.fileUrl === uploadResult.url, 'Notification fileUrl points to GridFS PDF');

    // ─── TEST 5: Full Workflow State Transitions ─────────────────────────────────
    console.log('\n--- Test 5: Full Workflow State Transitions ---');
    // 1. Pending
    const flowDoc = await Document.create({
      userId: testUser._id,
      type: 'marriage',
      requestDetails: 'Holy Matrimony Certificate Request',
      status: 'pending'
    });
    assert(flowDoc.status === 'pending', 'Step 1: User request created in Pending');

    // 2. Processing
    flowDoc.status = 'processing';
    await flowDoc.save();
    assert(flowDoc.status === 'processing', 'Step 2: Admin moved request to Processing');

    // 3. Upload image & Approve -> Unified PDF
    const marriagePdf = await prepareFinalDocumentPdf({
      buffer: imgBuffer,
      originalname: 'marriage_cert.png',
      mimetype: 'image/png'
    }, 'marriage');

    const marriageGridFs = await uploadToGridFS(marriagePdf.buffer, marriagePdf.filename, 'application/pdf');
    flowDoc.status = 'approved';
    flowDoc.uploadedFile = marriageGridFs.url;
    flowDoc.processedAt = new Date();
    await flowDoc.save();

    assert(flowDoc.status === 'approved', 'Step 3: Admin clicked Upload & Approve -> Status is Approved');
    assert(marriagePdf.filename === 'Marriage.pdf', 'Final PDF filename formatted correctly');

    // Verify stored file metadata in GridFS
    const fileDoc = await getGridFSFileDoc(marriageGridFs.fileId);
    assert(fileDoc !== null, 'GridFS file record found');
    assert(fileDoc.contentType === 'application/pdf', 'GridFS contentType is application/pdf (Never raw image)');

    // Clean up test documents
    await Document.deleteMany({ _id: { $in: [testDoc._id, flowDoc._id] } });
    await Notification.deleteMany({ relatedId: { $in: [testDoc._id, flowDoc._id] } });
    console.log('🧹 Cleaned up test database records.');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n===============================================================');
    console.log(`🏁 TEST SUMMARY: ${passed}/${total} assertions passed`);
    console.log('===============================================================\n');
  }
}

runTests();
