const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Booking = require('../models/Booking');
const Donation = require('../models/Donation');
const PrayerRequest = require('../models/PrayerRequest');
const Ticket = require('../models/Ticket');

/**
 * Generates the Official Member Profile & Activity Record PDF (matching Images 2 & 3).
 * Contains QR Code verification, sacraments records, family details, and activity metrics.
 *
 * @param {Object} user - User document or populated object
 * @param {Object} sessionInfo - Optional session snapshot { ip, device, browser, os }
 * @returns {Promise<string>} - Relative URL of the generated PDF (/uploads/member-reports/User_...)
 */
const generateUserReportPdf = async (user, sessionInfo = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!user) throw new Error('User data is required to generate report');

      // Fetch user's dynamic church activity metrics
      let massBookingsCount = 0;
      let donationsTotal = 0;
      let prayerRequestsCount = 0;
      let ticketsCount = 0;

      try {
        if (user?._id) {
          const [mbCount, donStats, prCount, tCount] = await Promise.all([
            Booking.countDocuments({ userId: user._id }).catch(() => 0),
            Donation.aggregate([
              { $match: { userId: user._id } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).catch(() => []),
            PrayerRequest.countDocuments({ userId: user._id }).catch(() => 0),
            Ticket.countDocuments({ userId: user._id }).catch(() => 0)
          ]);
          massBookingsCount = mbCount || 0;
          donationsTotal = donStats?.[0]?.total || 0;
          prayerRequestsCount = prCount || 0;
          ticketsCount = tCount || 0;
        }
      } catch (dbErr) {
        console.warn('Activity metrics fetch warning:', dbErr.message);
      }

      // Generate secure QR code containing web report verification URL
      if (!process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET environment variable is not configured');
      }
      const secureToken = jwt.sign(
        { userId: user._id, type: 'member_report' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const qrReportWebUrl = `${clientUrl}/member-report/${secureToken}`;

      const qrDataUrl = await QRCode.toDataURL(qrReportWebUrl);
      const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });

      const safeName = (user.name || 'User').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `User_${safeName}_Report_${Date.now()}.pdf`;
      const dir = path.join(__dirname, '..', '..', 'uploads', 'member-reports');

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, filename);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageWidth = 595.28;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // 523.28

      let curY = 36;

      const checkPageOverflow = (heightNeeded = 25) => {
        if (curY + heightNeeded > 735) {
          doc.addPage();
          doc.rect(margin, 36, contentWidth, 3).fill('#1e3a8a');
          curY = 48;
        }
      };

      // --- Top Header Accent Bar ---
      doc.rect(margin, 36, contentWidth, 5).fill('#1e3a8a');

      // Title & Subtitle
      doc.fillColor('#1e3a8a')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text("St. John de Britto's Church", margin, 48, { width: contentWidth - 95, align: 'left' });

      doc.fillColor('#b45309')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text("Kalayarkoil, Sivagangai District, Tamil Nadu - 630551", margin, 74, { width: contentWidth - 95, align: 'left' });

      // QR Code top right inside frame
      doc.rect(pageWidth - margin - 75, 46, 75, 75).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.image(qrImageBuffer, pageWidth - margin - 71, 50, { width: 67, height: 67 });

      // Document Title & Timestamp
      doc.fillColor('#0f172a')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text("OFFICIAL MEMBER PROFILE & ACTIVITY RECORD", margin, 92);

      const lastModStr = user.updatedAt 
        ? new Date(user.updatedAt).toLocaleString('en-GB') 
        : (user.createdAt ? new Date(user.createdAt).toLocaleString('en-GB') : 'N/A');

      doc.fillColor('#64748b')
         .fontSize(8.5)
         .font('Helvetica')
         .text(`Report Generated: ${new Date().toLocaleString('en-GB')}  |  Last Profile Update: ${lastModStr}`, margin, 108);

      // Divider Line
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(margin, 122).lineTo(pageWidth - margin, 122).stroke();

      curY = 132;

      // Helper: Draw Section Title Box
      const drawSectionHeader = (title) => {
        checkPageOverflow(30);
        doc.rect(margin, curY, contentWidth, 20).fill('#f1f5f9');
        doc.rect(margin, curY, 4, 20).fill('#1e3a8a');
        doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold').text(title, margin + 12, curY + 5);
        curY += 25;
      };

      // Helper: Draw Single Key-Value Row
      const renderFieldLine = (label, value, isHighlight = false) => {
        const displayVal = (value !== undefined && value !== null && String(value).trim() !== '') ? String(value) : 'N/A';
        const labelX = margin + 12;
        const valX = margin + 175;
        const maxValWidth = contentWidth - 187;

        const textHeight = doc.heightOfString(displayVal, { width: maxValWidth });
        const rowHeight = Math.max(16, textHeight + 4);

        checkPageOverflow(rowHeight);

        doc.fillColor('#475569').fontSize(9.5).font('Helvetica-Bold').text(label, labelX, curY, { width: 155 });

        if (isHighlight) {
          doc.fillColor('#1e3a8a').fontSize(9.5).font('Helvetica-Bold').text(displayVal, valX, curY, { width: maxValWidth });
        } else {
          doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica').text(displayVal, valX, curY, { width: maxValWidth });
        }

        curY += rowHeight;
      };

      // 1. PERSONAL & CONTACT INFORMATION
      drawSectionHeader('PERSONAL & CONTACT INFORMATION');
      renderFieldLine('Full Name:', user.name);
      renderFieldLine('Parish Member ID:', user.parishMemberId || 'N/A', true);
      renderFieldLine('Family ID:', user.familyId || 'N/A', true);
      renderFieldLine('Primary Phone:', user.phone);
      renderFieldLine('Email Address:', user.email);
      renderFieldLine('Date of Birth:', user.dob ? new Date(user.dob).toLocaleDateString('en-GB') : 'N/A');
      renderFieldLine('Gender:', user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not Specified');
      renderFieldLine('Blood Group:', user.bloodGroup || 'N/A');
      renderFieldLine('Residential Address:', user.address);
      renderFieldLine('Registration Date:', user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A');
      renderFieldLine('Last Profile Modification:', lastModStr);
      renderFieldLine('Last System Activity:', user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-GB') : (user.lastSuccessfulLogin ? new Date(user.lastSuccessfulLogin).toLocaleString('en-GB') : 'Never'));

      curY += 4;

      // 2. PARISH & ECCLESIAL MEMBERSHIP
      drawSectionHeader('PARISH & ECCLESIAL MEMBERSHIP');
      renderFieldLine('Primary Parish:', "St. John de Britto's Church, Kalayarkoil");
      renderFieldLine('Anbiyam Name:', user.anbiyam || user.sccGroup || 'N/A');
      renderFieldLine('Member Status:', user.memberStatus || (user.isSuspended ? 'Suspended' : (user.isActive ? 'Active' : 'Inactive')));
      renderFieldLine('System Access Role:', (user.role || 'user').toUpperCase());
      renderFieldLine('Account Verification:', user.isVerified ? 'Verified Account' : 'Pending Verification');

      curY += 4;

      // 3. FAMILY & HOUSEHOLD DETAILS
      drawSectionHeader('FAMILY & HOUSEHOLD DETAILS');
      renderFieldLine('Family Name:', user.familyName);
      renderFieldLine('Family ID:', user.familyId || 'N/A', true);
      renderFieldLine('Role in Household:', user.familyRole);
      renderFieldLine('Wedding Anniversary:', user.weddingDate ? new Date(user.weddingDate).toLocaleDateString('en-GB') : (user.sacraments?.marriageDate ? new Date(user.sacraments.marriageDate).toLocaleDateString('en-GB') : 'N/A'));
      renderFieldLine('Spouse Name:', user.sacraments?.spouseName || 'N/A');

      if (user.familyMembers && user.familyMembers.length > 0) {
        const famList = user.familyMembers.map(m => `${m.name} (${m.role || 'Member'})`).join(', ');
        renderFieldLine('Registered Family Members:', famList);
      } else {
        renderFieldLine('Registered Family Members:', 'None registered');
      }

      curY += 4;

      // 4. HOLY SACRAMENTS RECORD
      drawSectionHeader('HOLY SACRAMENTS RECORD');
      const bDate = user.sacraments?.baptismDate ? new Date(user.sacraments.baptismDate).toLocaleDateString('en-GB') : 'N/A';
      const bParish = user.sacraments?.baptismParish || 'N/A';
      const bCert = user.sacraments?.baptismCertNo || 'N/A';
      renderFieldLine('Holy Baptism:', `Date: ${bDate} | Parish: ${bParish} | Cert No: ${bCert}`);

      const fcDate = user.sacraments?.firstCommunionDate ? new Date(user.sacraments.firstCommunionDate).toLocaleDateString('en-GB') : 'N/A';
      renderFieldLine('First Holy Communion:', `Date: ${fcDate}`);

      const cDate = user.sacraments?.confirmationDate ? new Date(user.sacraments.confirmationDate).toLocaleDateString('en-GB') : 'N/A';
      renderFieldLine('Holy Confirmation:', `Date: ${cDate}`);

      const mDate = user.sacraments?.marriageDate ? new Date(user.sacraments.marriageDate).toLocaleDateString('en-GB') : (user.weddingDate ? new Date(user.weddingDate).toLocaleDateString('en-GB') : 'N/A');
      const spouse = user.sacraments?.spouseName || 'N/A';
      renderFieldLine('Holy Matrimony:', `Date: ${mDate} | Spouse: ${spouse}`);

      curY += 4;

      // 5. ACTIVITY & STATISTICS SUMMARY
      drawSectionHeader('ACTIVITY & STATISTICS SUMMARY');
      checkPageOverflow(55);

      const cardWidth = (contentWidth - 30) / 4;
      const cardHeight = 46;
      const cardY = curY;

      const metrics = [
        { label: 'Mass Bookings', val: `${massBookingsCount}`, color: '#2563eb' },
        { label: 'Total Donations', val: `Rs. ${donationsTotal.toLocaleString('en-IN')}`, color: '#16a34a' },
        { label: 'Prayer Requests', val: `${prayerRequestsCount}`, color: '#d97706' },
        { label: 'Support Tickets', val: `${ticketsCount}`, color: '#9333ea' }
      ];

      metrics.forEach((m, idx) => {
        const cardX = margin + idx * (cardWidth + 10);
        doc.rect(cardX, cardY, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.rect(cardX, cardY, cardWidth, 3).fill(m.color);

        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(m.label, cardX + 4, cardY + 8, { width: cardWidth - 8, align: 'center' });
        doc.fillColor(m.color).fontSize(12).font('Helvetica-Bold').text(m.val, cardX + 4, cardY + 22, { width: cardWidth - 8, align: 'center' });
      });

      curY += cardHeight + 10;

      // 6. EMERGENCY CONTACT (if available)
      if (user.settings?.emergencyContact?.name) {
        drawSectionHeader('EMERGENCY CONTACT');
        renderFieldLine('Contact Name:', user.settings.emergencyContact.name);
        renderFieldLine('Relationship:', user.settings.emergencyContact.relationship);
        renderFieldLine('Emergency Phone:', user.settings.emergencyContact.phone);
        curY += 4;
      }

      // --- Footer Page Numbers across all generated pages ---
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(margin, 765).lineTo(pageWidth - margin, 765).stroke();
        doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text(
          `St. John de Britto's Church, Kalayarkoil — Official Member Record | Page ${i + 1} of ${range.count}`,
          margin,
          774,
          { align: 'center', width: contentWidth }
        );
      }

      doc.end();

      stream.on('finish', () => {
        const relativeUrl = `/uploads/member-reports/${filename}`;
        resolve(relativeUrl);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateUserReportPdf };
