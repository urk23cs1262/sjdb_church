const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendMail } = require('../config/mailer');
const { sendPushToUser } = require('./webPushService');
const { getGridFSBuffer, uploadToGridFS } = require('./gridfsService');
const { getSiteUrl } = require('../config/siteRoutes');
const { sendWhatsAppMessage, sendWhatsAppDocument } = require('../bot/whatsapp');
const { sendWhatsApp: sendTwilioWhatsApp } = require('../config/twilio');

/**
 * Normalizes document type into a clean, human-readable title.
 */
const formatDocTypeName = (rawType = '') => {
  const clean = String(rawType || 'Document').replace(/[_-]/g, ' ').trim();
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Formats a clean reference request ID.
 */
const formatDocRequestId = (document = {}) => {
  const mongoId = document._id ? document._id.toString() : '';
  const shortId = mongoId ? mongoId.slice(-6).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DOC-${shortId}`;
};

/**
 * Formats a clean, safe PDF filename.
 */
const getCanonicalPdfFilename = (docType = '', originalname = '') => {
  const baseType = formatDocTypeName(docType).replace(/\s+/g, '_');
  if (baseType && baseType !== 'Document') {
    return `${baseType}.pdf`;
  }
  if (originalname) {
    const rawName = path.basename(originalname, path.extname(originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${rawName || 'Document'}.pdf`;
  }
  return 'Church_Document.pdf';
};

/**
 * Converts an image buffer (JPG, JPEG, PNG, etc.) into a 1:1 lossless PDF buffer.
 */
const convertImageToPdfBuffer = (imageBuffer) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const img = doc.openImage(imageBuffer);
      // Create a page matching the image dimensions with 0 margin for 1:1 crisp rendering
      doc.addPage({ size: [img.width, img.height], margin: 0 });
      doc.image(img, 0, 0, { width: img.width, height: img.height });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Checks if a buffer represents a valid PDF file.
 */
const isPdfBuffer = (buffer) => {
  if (!buffer || buffer.length < 5) return false;
  return buffer.slice(0, 5).toString('ascii') === '%PDF-';
};

/**
 * Prepares the final document as a unified PDF.
 * - If admin uploaded a PDF, uses it directly.
 * - If admin uploaded an image (JPG, JPEG, PNG, etc.), converts it into a PDF.
 * - Guaranteed to return one final PDF buffer with contentType 'application/pdf'.
 */
const prepareFinalDocumentPdf = async (file, docType = '') => {
  if (!file || (!file.buffer && !file.path)) {
    throw new Error('No valid file supplied for document processing');
  }

  const rawBuffer = file.buffer || fs.readFileSync(file.path);
  const originalname = file.originalname || 'document';
  const mimetype = (file.mimetype || '').toLowerCase();
  const ext = path.extname(originalname).toLowerCase();

  const isAlreadyPdf = mimetype === 'application/pdf' || ext === '.pdf' || isPdfBuffer(rawBuffer);
  const cleanFilename = getCanonicalPdfFilename(docType, originalname);

  if (isAlreadyPdf) {
    return {
      buffer: rawBuffer,
      filename: cleanFilename,
      mimetype: 'application/pdf',
      isConverted: false,
      size: rawBuffer.length
    };
  }

  // Handle Image Conversion -> Single Final PDF
  try {
    const pdfBuffer = await convertImageToPdfBuffer(rawBuffer);
    return {
      buffer: pdfBuffer,
      filename: cleanFilename,
      mimetype: 'application/pdf',
      isConverted: true,
      size: pdfBuffer.length
    };
  } catch (convErr) {
    console.error('[DocumentDelivery] Image to PDF conversion failed:', convErr.message);
    throw new Error(`Failed to convert uploaded image into PDF: ${convErr.message}`);
  }
};

/**
 * Helper to dispatch WhatsApp text message to user.
 */
const dispatchWhatsAppText = async (phoneNumber, text) => {
  try {
    const sent = await sendWhatsAppMessage(phoneNumber, text);
    if (sent) return true;
  } catch (err) {
    console.warn('[DocumentDelivery] Baileys bot dispatch error:', err.message);
  }

  // Fallback to Twilio if Baileys did not deliver
  try {
    let formatted = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    await sendTwilioWhatsApp(formatted, text);
    return true;
  } catch (tErr) {
    console.warn('[DocumentDelivery] Twilio WhatsApp fallback error:', tErr.message);
    return false;
  }
};

/**
 * Delivers the approved final PDF through ALL configured notification channels
 * that the user is permitted/enabled to receive:
 * 1. Email (PDF attached as actual email attachment)
 * 2. WhatsApp Bot (Actual PDF document attached & sent in chat)
 * 3. Website / In-App Notification (Notification with secure link)
 * 4. Web Push Notification (Mobile/Browser push alert with secure link)
 */
const deliverApprovedDocument = async ({ document, user: userParam, finalPdfBuffer: pdfBufferParam, filename: customFilename, adminNote }) => {
  const channelsDelivered = [];
  const errors = [];

  try {
    // 1. Resolve User
    let user = userParam;
    if (!user && document.userId) {
      if (typeof document.userId === 'object' && (document.userId.email || document.userId.phone || document.userId.name)) {
        user = document.userId;
      } else {
        user = await User.findById(document.userId).select('name phone email parishMemberId familyId anbiyam settings whatsappOptIn');
      }
    }

    const userName = user?.name || 'Parishioner';
    const userEmail = user?.email || null;
    let userPhone = user?.phone || null;

    if (userPhone) {
      userPhone = userPhone.trim().replace(/\D/g, '');
    }

    // 2. Resolve Document Names, IDs & Links
    const docType = document.type || 'parish_membership';
    const docTypeName = formatDocTypeName(docType);
    const requestId = formatDocRequestId(document);
    const filename = customFilename || getCanonicalPdfFilename(docType);
    const userDeepLinkPath = `/my-requests/document-requests/${requestId}`;
    const secureReviewUrl = getSiteUrl(userDeepLinkPath);

    // 3. Resolve Final PDF Buffer (from argument, or from GridFS if already uploaded)
    let finalPdfBuffer = pdfBufferParam;
    if (!finalPdfBuffer && document.uploadedFile) {
      try {
        finalPdfBuffer = await getGridFSBuffer(document.uploadedFile);
      } catch (bufErr) {
        console.warn('[DocumentDelivery] Could not retrieve PDF buffer from GridFS:', bufErr.message);
      }
    }

    // 4. Resolve User Permissions / Notification Settings
    const userSettings = user?.settings?.notifications || {};
    const allowEmail = userEmail && userEmail.includes('@') && userSettings.email !== false;
    const allowWhatsApp = userPhone && userPhone.length >= 10 && userSettings.whatsapp !== false && user?.whatsappOptIn !== false;
    const allowPush = userSettings.push !== false;
    const allowInApp = userSettings.inApp !== false;

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNEL 1: EMAIL WITH ACTUAL PDF ATTACHMENT
    // ─────────────────────────────────────────────────────────────────────────
    if (allowEmail) {
      try {
        const emailSubject = `Document Request Approved – ${docTypeName}`;
        const emailAttachments = [];

        if (finalPdfBuffer && Buffer.isBuffer(finalPdfBuffer)) {
          emailAttachments.push({
            filename: filename,
            content: finalPdfBuffer,
            contentType: 'application/pdf'
          });
        }

        const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 620px; margin: 25px auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .logo-box { width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; background: #ffffff; overflow: hidden; border: 3px solid #fbbf24; }
    .content { padding: 30px 26px; color: #1e293b; line-height: 1.6; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; margin-bottom: 16px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13.5px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .attachment-banner { background: #eff6ff; border: 1.5px dashed #3b82f6; border-radius: 12px; padding: 16px; text-align: center; margin: 22px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 12px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(37,99,235,0.3); }
    .footer { background: #0f172a; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-box">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="color:#fbbf24; margin:0 0 4px; font-size:20px; font-weight:800;">St. John de Britto Church</h1>
      <p style="margin:0; font-size:12px; color:#cbd5e1; font-weight:600; letter-spacing:0.5px;">OFFICIAL CERTIFICATE & DOCUMENT DELIVERY</p>
    </div>
    <div class="content">
      <div class="badge">
        ✅ Document Request Approved
      </div>

      <p style="font-size:16px; color:#0f172a; margin-top:0;">Dear ${userName},</p>
      <p style="font-size:15px; color:#334155;">
        Your <strong>${docTypeName}</strong> document request has been approved.
      </p>
      <p style="font-size:15px; color:#334155;">
        Please find your approved document attached to this email as a PDF.
      </p>
      <p style="font-size:15px; color:#334155;">
        You can also review your request securely on the Church website.
      </p>

      <div class="card">
        <div class="row">
          <span class="label">Document Type:</span>
          <span class="val">${docTypeName}</span>
        </div>
        <div class="row">
          <span class="label">Request Reference:</span>
          <span class="val font-mono" style="color:#2563eb;">${requestId}</span>
        </div>
        <div class="row">
          <span class="label">Status:</span>
          <span class="val" style="color:#16a34a;">Approved</span>
        </div>
        ${adminNote ? `
        <div class="row">
          <span class="label">Church Note:</span>
          <span class="val" style="color:#78350f;">${adminNote}</span>
        </div>` : ''}
      </div>

      <div class="attachment-banner">
        <div style="font-size:18px; margin-bottom:4px;">📎</div>
        <div style="font-size:14px; font-weight:700; color:#1e40af;">
          Attached: ${filename}
        </div>
        <div style="font-size:12px; color:#64748b; margin-top:2px;">
          The official church document is attached directly to this email in PDF format.
        </div>
      </div>

      <div style="text-align:center; margin:26px 0 10px;">
        <a href="${secureReviewUrl}" class="btn">
          👉 Review Request on Church Website →
        </a>
      </div>
    </div>
    <div class="footer">
      <p style="margin:0 0 4px; font-weight:700; color:#cbd5e1;">St. John de Britto Church, Kalayarkoil - 630551</p>
      <p style="margin:0; color:#64748b;">Automated Document Delivery System • Parish Administration</p>
    </div>
  </div>
</body>
</html>`;

        await sendMail({
          to: userEmail,
          subject: emailSubject,
          html: emailHtml,
          attachments: emailAttachments
        });

        channelsDelivered.push('email');
        console.log(`[DocumentDelivery] Email with PDF attachment sent to ${userEmail}`);
      } catch (eErr) {
        console.error('[DocumentDelivery] Email delivery error:', eErr.message);
        errors.push({ channel: 'email', message: eErr.message });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNEL 2: WHATSAPP BOT (TEXT MESSAGE + ACTUAL PDF DOCUMENT)
    // ─────────────────────────────────────────────────────────────────────────
    if (allowWhatsApp) {
      try {
        let formattedPhone = userPhone;
        if (formattedPhone.length === 10 && !formattedPhone.startsWith('91')) {
          formattedPhone = `91${formattedPhone}`;
        }

        // WhatsApp notification message
        const waMessage =
`📄 *Document Request Approved*

Your *${docTypeName}* document has been approved.

Your approved document is attached as a PDF.

You can also review your request here:
👉 *Review Document:*
${secureReviewUrl}`;

        // Send WhatsApp approval notification text
        await dispatchWhatsAppText(formattedPhone, waMessage);

        // Immediately send the actual PDF document file via Baileys socket
        if (finalPdfBuffer && Buffer.isBuffer(finalPdfBuffer)) {
          const docSent = await sendWhatsAppDocument(formattedPhone, {
            buffer: finalPdfBuffer,
            fileName: filename,
            mimetype: 'application/pdf',
            caption: `📄 *${docTypeName}* (Approved Church Document)`
          });

          if (docSent) {
            console.log(`[DocumentDelivery] WhatsApp PDF document sent to ${formattedPhone}`);
          }
        }

        channelsDelivered.push('whatsapp');
      } catch (waErr) {
        console.error('[DocumentDelivery] WhatsApp delivery error:', waErr.message);
        errors.push({ channel: 'whatsapp', message: waErr.message });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNEL 3: IN-APP / WEBSITE NOTIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    if (allowInApp && user?._id) {
      try {
        const notifTitle = `Document Request Approved – ${docTypeName}`;
        const notifMessage = `Your ${docTypeName} document request has been approved. Please find your approved document attached or review it securely on the Church website.`;

        await Notification.create({
          recipient: 'user',
          userId: user._id,
          title: notifTitle,
          message: notifMessage,
          type: 'documents',
          category: 'documents',
          priority: 'high',
          actionUrl: userDeepLinkPath,
          relatedId: document._id,
          relatedModel: 'Document',
          fileUrl: document.uploadedFile,
          metadata: {
            action: 'approved',
            module: 'document_request',
            requestId,
            docType,
            docTypeName,
            filename,
            adminNote,
            reviewUrl: secureReviewUrl,
            timestamp: new Date()
          },
          sentVia: ['email', 'whatsapp', 'push', 'inApp', 'website']
        });

        channelsDelivered.push('inApp');
      } catch (inAppErr) {
        console.error('[DocumentDelivery] In-app notification error:', inAppErr.message);
        errors.push({ channel: 'inApp', message: inAppErr.message });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHANNEL 4: WEB PUSH NOTIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    if (allowPush && user?._id) {
      try {
        sendPushToUser(user._id, {
          title: `Document Approved: ${docTypeName}`,
          body: `Your ${docTypeName} document request has been approved and is ready for download.`,
          url: userDeepLinkPath,
          tag: `user-doc-${requestId}`,
          icon: '/favicon.png',
          badge: '/favicon.png',
          data: {
            url: userDeepLinkPath,
            requestId
          }
        }).catch(pErr => console.warn('[DocumentDelivery] Web push error:', pErr.message));

        channelsDelivered.push('push');
      } catch (pushErr) {
        console.warn('[DocumentDelivery] Web push error:', pushErr.message);
      }
    }

    return {
      success: true,
      channelsDelivered,
      errors: errors.length > 0 ? errors : null,
      filename
    };
  } catch (err) {
    console.error('[DocumentDelivery] deliverApprovedDocument critical error:', err.message);
    return {
      success: false,
      error: err.message,
      channelsDelivered
    };
  }
};

module.exports = {
  formatDocTypeName,
  formatDocRequestId,
  getCanonicalPdfFilename,
  convertImageToPdfBuffer,
  prepareFinalDocumentPdf,
  deliverApprovedDocument
};
