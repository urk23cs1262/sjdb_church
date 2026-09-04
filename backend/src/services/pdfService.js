const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const DONATION_LABELS = {
  general: 'General Offering',
  feast: 'Feast Donation',
  building: 'Building Fund',
  candle: 'Candle Offering',
  tithe: 'Tithe Offering',
  special: 'Special Offering'
};

const generateDonationReceipt = async (donation, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const receiptId = donation._id.toString().slice(-6).toUpperCase();
      const filename = `Donation_Receipt_${receiptId}.pdf`;
      const dir = path.join(__dirname, '..', '..', 'uploads', 'receipts');

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, filename);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      const createdAtDate = donation.paidAt || (donation.createdAt ? new Date(donation.createdAt) : new Date());
      const dateStr = createdAtDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const timeStr = createdAtDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const donorName = donation.donorName || user?.name || donation.userId?.name || 'N/A';
      const categoryLabel = DONATION_LABELS[donation.type] || donation.type || 'General Offering';
      const purposeText = categoryLabel.toLowerCase().includes('offering') || categoryLabel.toLowerCase().includes('fund') || categoryLabel.toLowerCase().includes('donation')
        ? categoryLabel
        : `${categoryLabel} Offering`;

      const paymentRef = donation.razorpayPaymentId || donation.transactionId || 'N/A';
      const paymentMethod = donation.razorpayPaymentId ? 'Razorpay (Online)' : (donation.paymentMethod ? (donation.paymentMethod.charAt(0).toUpperCase() + donation.paymentMethod.slice(1)) : 'UPI');

      // ─── 1. Top Meta Line ──────────────────────────────────────────────────
      doc.fontSize(9.5).fillColor('#333333').font('Helvetica');
      doc.text(`${dateStr}, ${timeStr}`, 40, 35);
      doc.text(`SJBC-${receiptId}`, 40, 35, { align: 'right', width: 515 });

      doc.moveDown(1.2);

      // ─── 2. Header: Logo + Church Details on Left, "Receipt" on Right ─────────
      const headerTop = 60;
      const logoPath = path.join(__dirname, '..', 'assets', 'church_extirior.png');
      const fallbackLogo = path.join(__dirname, '..', 'assets', 'sjdb_image.png');
      const activeLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(fallbackLogo) ? fallbackLogo : null);

      if (activeLogo) {
        try {
          doc.image(activeLogo, 40, headerTop, { width: 60, height: 60, fit: [60, 60] });
        } catch { }
      }

      // Church name & address (Left aligned next to logo)
      doc.fontSize(19).fillColor('#1e3a8a').font('Helvetica-Bold');
      doc.text("ST. JOHN DE britto CHURCH", 110, headerTop + 4);

      doc.fontSize(11).fillColor('#b8860b').font('Helvetica');
      doc.text("Kalayarkoil Parish • Sivagangai Diocese", 110, headerTop + 26);

      doc.fontSize(8.5).fillColor('#555555').font('Helvetica');
      doc.text("Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.", 110, headerTop + 42);

      // "Receipt" Title on top right
      doc.fontSize(24).fillColor('#000000').font('Helvetica-Bold');
      doc.text("Receipt", 40, headerTop + 14, { align: 'right', width: 515 });

      // Horizontal line
      const lineY = headerTop + 68;
      doc.moveTo(40, lineY).lineTo(555, lineY).strokeColor('#e5e5e5').lineWidth(1.5).stroke();

      // ─── 3. Two-Column Grid ────────────────────────────────────────────────
      const gridTop = lineY + 18;
      doc.fontSize(10.5).fillColor('#111827');

      // Left Column
      const leftColX = 40;
      const leftValX = 150;

      doc.font('Helvetica-Bold').text("Receipt No :", leftColX, gridTop);
      doc.font('Helvetica').text(`SJBC-${createdAtDate.getFullYear()}-${receiptId}`, leftValX, gridTop);

      doc.font('Helvetica-Bold').text("Name :", leftColX, gridTop + 22);
      doc.font('Helvetica').text(donorName, leftValX, gridTop + 22);

      doc.font('Helvetica-Bold').text("Donation Type :", leftColX, gridTop + 44);
      doc.font('Helvetica').text(categoryLabel, leftValX, gridTop + 44);

      doc.font('Helvetica-Bold').text("Purpose :", leftColX, gridTop + 66);
      doc.font('Helvetica').text(purposeText, leftValX, gridTop + 66);

      // Right Column
      const rightColX = 310;
      const rightValX = 430;

      doc.font('Helvetica-Bold').text("Receipt Date :", rightColX, gridTop);
      doc.font('Helvetica').text(dateStr, rightValX, gridTop);

      doc.font('Helvetica-Bold').text("Total Paid :", rightColX, gridTop + 22);
      doc.font('Helvetica-Bold').text(`INR. ${(donation.amount || 0).toFixed(2)}`, rightValX, gridTop + 22);

      doc.font('Helvetica-Bold').text("Payment Method :", rightColX, gridTop + 44);
      doc.font('Helvetica').text(paymentMethod, rightValX, gridTop + 44);

      doc.font('Helvetica-Bold').text("Payment ID :", rightColX, gridTop + 66);
      doc.font('Helvetica').text(paymentRef, rightValX, gridTop + 66, { width: 125, ellipsis: true });

      // ─── 4. Table: Donation Description & Amount Paid ───────────────────────
      const tableTop = gridTop + 105;

      // Table Header (light grey background)
      doc.rect(40, tableTop, 515, 26).fill('#f3f4f6').stroke('#dddddd');
      doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
      doc.text("Donation Description", 52, tableTop + 8);
      doc.text("Amount Paid", 450, tableTop + 8, { align: 'right', width: 90 });

      // Table Row
      doc.rect(40, tableTop + 26, 515, 34).stroke('#dddddd');
      doc.fontSize(10).fillColor('#333333').font('Helvetica');
      doc.text(purposeText, 52, tableTop + 37);
      doc.font('Helvetica-Bold').text(`Rs. ${(donation.amount || 0).toFixed(2)}`, 450, tableTop + 37, { align: 'right', width: 90 });

      // ─── 5. Message / Intention Box ─────────────────────────────────────────
      const noteY = tableTop + 75;
      const noteContent = donation.note || donation.message || 'Prayers for parish and family blessings';

      doc.rect(40, noteY, 515, 50).fill('#fafafa').stroke('#dddddd');
      doc.fontSize(9.5).fillColor('#000000').font('Helvetica-Bold');
      doc.text("Message / Intention :", 40, noteY + 8, { align: 'center', width: 515 });
      doc.fontSize(10).fillColor('#333333').font('Helvetica');
      doc.text(`"${noteContent}"`, 55, noteY + 25, { align: 'center', width: 485 });

      // ─── 6. Thank You & Blessing ────────────────────────────────────────────
      const blessingY = noteY + 70;
      doc.fontSize(10).fillColor('#222222').font('Helvetica');
      doc.text("Thank you for your generous contribution", 40, blessingY, { align: 'center', width: 515 });
      doc.text("towards the ministry and mission of", 40, blessingY + 14, { align: 'center', width: 515 });
      doc.font('Helvetica-Bold').text("St. John de britto Church.", 40, blessingY + 28, { align: 'center', width: 515 });

      doc.font('Helvetica').text("May God bless you abundantly.", 40, blessingY + 52, { align: 'center', width: 515 });

      // ─── 7. Contact Details ─────────────────────────────────────────────────
      const contactY = blessingY + 85;
      doc.fontSize(9).fillColor('#555555').font('Helvetica');
      doc.text("Contact Details :", 40, contactY, { align: 'center', width: 515 });
      doc.text("Parish Office Phone : +91 96291 95484", 40, contactY + 14, { align: 'center', width: 515 });
      doc.text("Parish Office Email : arndas777@gmail.com", 40, contactY + 26, { align: 'center', width: 515 });
      doc.text("Parish Office Website : www.stjohnchurch.com", 40, contactY + 38, { align: 'center', width: 515 });

      // ─── 8. Bottom Statement (Properly Centered Without Overlap) ───────────
      const footerY = 745;
      doc.fontSize(13).font('Helvetica-Bold');
      const prefix = "Computer Generated Receipt. ";
      const suffix = "SIGNATURE NOT REQUIRED";
      const wPrefix = doc.widthOfString(prefix);
      const wSuffix = doc.widthOfString(suffix);
      const totalW = wPrefix + wSuffix;
      const startX = (595.28 - totalW) / 2;

      doc.fillColor('#000000').text(prefix, startX, footerY, { lineBreak: false });
      doc.fillColor('#dc2626').text(suffix, startX + wPrefix, footerY, { lineBreak: false });

      doc.end();

      stream.on('finish', () => {
        resolve(`/uploads/receipts/${filename}`);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateDonationReceipt };
