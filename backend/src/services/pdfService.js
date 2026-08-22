const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateDonationReceipt = async (donation, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const filename = `Receipt_${donation._id.toString().slice(-6).toUpperCase()}.pdf`;
      const dir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const filePath = path.join(dir, filename);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // --- Header ---
      doc.fillColor('#1e3a8a')
         .fontSize(24)
         .text("ST. JOHN DE BRITTO'S CHURCH", { align: 'center' });
      
      doc.fillColor('#555555')
         .fontSize(10)
         .text("Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.", { align: 'center' })
         .moveDown(0.5);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(1).stroke();
      doc.moveDown(1);

      // --- Title ---
      doc.fillColor('#333333')
         .fontSize(22)
         .text("DONATION RECEIPT", { align: 'center' })
         .moveDown(1.5);

      // --- Details Grid ---
      const startY = doc.y;
      
      // Left Column
      doc.fontSize(11).fillColor('#666666');
      doc.text("Receipt No :", 70, startY);
      doc.text("Name :", 70, startY + 22);
      doc.text("Donation Type :", 70, startY + 44);
      doc.text("Purpose :", 70, startY + 66);

      doc.fillColor('#000000');
      doc.text(`SJBC-${new Date(donation.createdAt).getFullYear()}-${donation._id.toString().slice(-6).toUpperCase()}`, 170, startY);
      doc.text(donation.donorName || user?.name || 'N/A', 170, startY + 22);
      doc.text(donation.type.toUpperCase(), 170, startY + 44);
      doc.text(`${donation.type.toUpperCase()} Offering`, 170, startY + 66);

      // Right Column
      doc.fillColor('#666666');
      doc.text("Receipt Date :", 320, startY);
      doc.text("Total Paid :", 320, startY + 22);
      doc.text("Payment Method :", 320, startY + 44);
      doc.text("UPI Ref No :", 320, startY + 66);

      doc.fillColor('#000000');
      doc.text(new Date(donation.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), 420, startY);
      doc.text(`INR. ${donation.amount.toFixed(2)}`, 420, startY + 22);
      doc.text("UPI", 420, startY + 44);
      doc.text(donation.transactionId || 'N/A', 420, startY + 66);

      doc.moveDown(6);

      // --- Table Header ---
      const tableTop = doc.y;
      doc.rect(70, tableTop, 455, 25).fill('#f3f4f6').stroke('#dddddd');
      doc.fillColor('#000000').fontSize(11).text("Donation Description", 80, tableTop + 7);
      doc.text("Amount Paid", 430, tableTop + 7);

      // --- Table Row ---
      doc.rect(70, tableTop + 25, 455, 35).stroke('#dddddd');
      doc.fillColor('#333333').text(`${donation.type.charAt(0).toUpperCase() + donation.type.slice(1)} Donation`, 80, tableTop + 37);
      doc.text(`Rs. ${donation.amount.toFixed(2)}`, 430, tableTop + 37);

      doc.moveDown(5);

      // --- Message ---
      if (donation.note) {
        doc.rect(70, doc.y, 455, 60).fill('#fafafa').stroke('#dddddd');
        doc.fillColor('#000000').fontSize(10).text("Message / Intention :", 80, doc.y + 10);
        doc.fillColor('#333333').fontSize(11).text(`"${donation.note}"`, 80, doc.y + 10);
        doc.moveDown(6);
      }

      // --- Thank You ---
      doc.moveDown(2);
      doc.fillColor('#1e3a8a')
         .fontSize(14)
         .text("Thank you for your generous contribution", { align: 'center' })
         .text("towards the ministry and mission of", { align: 'center' })
         .fontSize(15)
         .text("St. John de Britto's Church.", { align: 'center', bold: true });

      doc.moveDown();
      doc.fontSize(12).fillColor('#b8860b').text("May God bless you abundantly.", { align: 'center' });

      // --- Footer ---
      const footerTop = 720;
      doc.fontSize(9).fillColor('#777777');
      doc.text("Contact Details :", 50, footerTop, { align: 'center' });
      doc.text("Parish Office Phone : +91 96291 95484 | Parish Office Email : sjdbchurch@gmail.com", 50, footerTop + 15, { align: 'center' });
      doc.text("Parish Office Website : www.stjohnchurch.com", 50, footerTop + 30, { align: 'center' });
      
      doc.fontSize(13).fillColor('#ff0000').text("Computer Generated Receipt. SIGNATURE NOT REQUIRED", 50, footerTop + 55, { align: 'center', bold: true });

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
