const fs = require('fs');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Donation = require('../models/Donation');
const PrayerRequest = require('../models/PrayerRequest');
const Ticket = require('../models/Ticket');

// GET /api/users — admin
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const query = {};
    if (search) query.$or = [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (role) query.role = role;
    const total = await User.countDocuments(query);
    const users = await User.find(query).select('-passwordHash -otp -otpExpires').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, total, page: Number(page), users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/users/:id — admin or self
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -otp -otpExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/users/profile — self
const updateProfile = async (req, res) => {
  try {
    let { 
      name, familyName, familyId, dob, gender, address, email, phone,
      preferredLanguage, subStation, familyRole, familyMembers, settings,
      parishMemberId, anbiyam, sccGroup, parishZone, weddingDate, bloodGroup, memberStatus, sacraments
    } = req.body;
    
    if (email === "") email = undefined;
    if (gender === "" || gender === null) gender = undefined;

    // Parse familyMembers, settings, sacraments if sent as a JSON string from FormData
    if (typeof familyMembers === 'string') {
      try {
        familyMembers = JSON.parse(familyMembers);
      } catch (e) {
        console.error('Error parsing familyMembers:', e);
        familyMembers = [];
      }
    }

    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch (e) {
        console.error('Error parsing settings:', e);
      }
    }

    if (typeof sacraments === 'string') {
      try {
        sacraments = JSON.parse(sacraments);
      } catch (e) {
        console.error('Error parsing sacraments:', e);
      }
    }

    const updateData = { 
      name, familyName, familyId, dob, gender, address, email, 
      preferredLanguage, subStation, familyRole, 
      anbiyam: anbiyam !== undefined ? anbiyam : sccGroup, 
      parishZone, weddingDate, bloodGroup, memberStatus,
      familyMembers: Array.isArray(familyMembers) ? familyMembers : [] 
    };

    if (parishMemberId !== undefined && parishMemberId !== '') updateData.parishMemberId = parishMemberId;
    if (sacraments !== undefined) updateData.sacraments = sacraments;

    if (phone && phone.trim()) {
      phone = phone.trim();
      const phoneExists = await User.findOne({ phone, _id: { $ne: req.user._id } });
      if (phoneExists) {
        return res.status(409).json({ success: false, message: 'This phone number is already registered with another account.' });
      }
      updateData.phone = phone;
    }

    if (settings) updateData.settings = settings;

    if (req.body.removeProfilePhoto === 'true' || req.body.profilePhoto === '') {
      updateData.profilePhoto = '';
    } else if (req.file) {
      try {
        const { uploadToGridFS } = require('../services/gridfsService');
        const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        if (buffer) {
          const fileInfo = await uploadToGridFS(buffer, req.file.originalname || 'profile.jpg', req.file.mimetype || 'image/jpeg');
          updateData.profilePhoto = fileInfo.url;
        }
      } catch (e) {
        console.error('Error uploading profile photo to GridFS:', e.message);
      }
    }
    
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-passwordHash -otp -otpExpires');
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/users/:id — admin
const updateUser = async (req, res) => {
  try {
    const { 
      role, isActive, isVerified, name, email, phone, parishMemberId, 
      gender, dob, address, subStation, familyName, familyId, parishZone, 
      anbiyam, sccGroup, weddingDate, bloodGroup, memberStatus, sacraments 
    } = req.body;

    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email === "" ? undefined : email;
    if (phone !== undefined) updateData.phone = phone;
    if (parishMemberId !== undefined) updateData.parishMemberId = parishMemberId;
    if (gender !== undefined) updateData.gender = (gender === "" || gender === null) ? undefined : gender;
    if (dob !== undefined) updateData.dob = dob;
    if (address !== undefined) updateData.address = address;
    if (subStation !== undefined) updateData.subStation = subStation;
    
    // Automatic Family ID sync on familyName change:
    if (familyName !== undefined) {
      const trimmedFam = (familyName || '').trim();
      updateData.familyName = trimmedFam;
      if (familyId !== undefined && familyId.trim() !== '') {
        updateData.familyId = familyId.trim();
      } else if (trimmedFam) {
        const { resolveFamilyIdForName } = require('../services/memberIdService');
        const resolved = await resolveFamilyIdForName(trimmedFam, req.params.id);
        updateData.familyId = resolved.familyId;
      }
    } else if (familyId !== undefined) {
      updateData.familyId = (familyId || '').trim();
    }

    if (parishZone !== undefined) updateData.parishZone = parishZone;
    if (anbiyam !== undefined) updateData.anbiyam = anbiyam;
    else if (sccGroup !== undefined) updateData.anbiyam = sccGroup;
    if (weddingDate !== undefined) updateData.weddingDate = weddingDate;
    if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
    if (memberStatus !== undefined) updateData.memberStatus = memberStatus;
    if (sacraments !== undefined) updateData.sacraments = sacraments;
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-passwordHash');
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/users/family-id-by-name?name=...&excludeId=...
const getFamilyIdByName = async (req, res) => {
  try {
    const { name, excludeId } = req.query;
    if (!name || !name.trim()) {
      return res.json({ success: true, familyId: '', isExisting: false, familyName: '' });
    }
    const { resolveFamilyIdForName } = require('../services/memberIdService');
    const result = await resolveFamilyIdForName(name.trim(), excludeId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/existing-families
const getExistingFamilies = async (req, res) => {
  try {
    const users = await User.find({
      familyName: { $exists: true, $ne: '' },
      familyId: { $exists: true, $ne: '' }
    }).select('familyName familyId').lean();

    const familyMap = new Map();
    users.forEach(u => {
      const key = (u.familyName || '').trim();
      if (key) {
        if (!familyMap.has(key.toLowerCase())) {
          familyMap.set(key.toLowerCase(), {
            familyName: key,
            familyId: u.familyId,
            memberCount: 1
          });
        } else {
          familyMap.get(key.toLowerCase()).memberCount++;
        }
      }
    });

    const families = Array.from(familyMap.values()).sort((a, b) => a.familyName.localeCompare(b.familyName));
    res.json({ success: true, families });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id — admin
const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/users/change-password — self
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.user._id, { passwordHash });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/users/settings — self

const updateSettings = async (req, res) => {
  try {
    const { settings, mass_reflection_language } = req.body;
    if (!settings && !mass_reflection_language) {
      return res.status(400).json({ success: false, message: 'Settings payload is required' });
    }

    const updates = {};
    if (settings) {
      updates.settings = settings;
    }

    const lang = mass_reflection_language || 
                 settings?.notifications?.mass_reflection_language || 
                 settings?.mass_reflection_language;

    if (lang && ['ta', 'en', 'both'].includes(lang)) {
      updates.mass_reflection_language = lang;
      if (updates.settings) {
        if (!updates.settings.notifications) updates.settings.notifications = {};
        updates.settings.notifications.mass_reflection_language = lang;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select('-passwordHash -otp -otpExpires');

    res.json({ success: true, message: 'Settings saved successfully', user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to generate and stream complete PDF report for a user containing ALL updated profile & activity data
const generateComprehensiveUserPdfStream = async (user, res, isDownload = false) => {
  const Booking = require('../models/Booking');
  const Donation = require('../models/Donation');
  const PrayerRequest = require('../models/PrayerRequest');
  const Ticket = require('../models/Ticket');
  const QRCode = require('qrcode');
  const jwt = require('jsonwebtoken');

  // Aggregate statistics
  const massBookingsCount = await Booking.countDocuments({ userId: user._id });
  const donationStats = await Donation.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const donationsTotal = donationStats[0]?.total || 0;
  const prayerRequestsCount = await PrayerRequest.countDocuments({ userId: user._id });
  const ticketsCount = await Ticket.countDocuments({ userId: user._id });

  // Generate secure QR code containing web report URL with token
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
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename=User_${safeName}_Report.pdf`);

  doc.pipe(res);

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

  // --- Header Section ---
  doc.rect(margin, 36, contentWidth, 5).fill('#1e3a8a');

  // Title & Subtitle
  doc.fillColor('#1e3a8a').fontSize(22).font('Helvetica-Bold').text("St. John de Britto's Church", margin, 48, { width: contentWidth - 95, align: 'left' });
  doc.fillColor('#b45309').fontSize(10).font('Helvetica-Bold').text("Kalayarkoil, Sivagangai District, Tamil Nadu - 630551", margin, 74, { width: contentWidth - 95, align: 'left' });

  // QR Code top right inside frame
  doc.rect(pageWidth - margin - 75, 46, 75, 75).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.image(qrImageBuffer, pageWidth - margin - 71, 50, { width: 67, height: 67 });

  // Document Title & Timestamp
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text("OFFICIAL MEMBER PROFILE & ACTIVITY RECORD", margin, 92);

  const lastModStr = user.updatedAt ? new Date(user.updatedAt).toLocaleString('en-GB') : (user.createdAt ? new Date(user.createdAt).toLocaleString('en-GB') : 'N/A');
  doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text(`Report Generated: ${new Date().toLocaleString('en-GB')}  |  Last Profile Update: ${lastModStr}`, margin, 108);

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

  // 1. PERSONAL INFORMATION
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
  // renderFieldLine('Parish Zone / Ward:', user.parishZone || 'N/A');
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
  const fcParish = user.sacraments?.firstCommunionParish || 'N/A';
  renderFieldLine('First Holy Communion:', `Date: ${fcDate}`);

  const cDate = user.sacraments?.confirmationDate ? new Date(user.sacraments.confirmationDate).toLocaleDateString('en-GB') : 'N/A';
  const cParish = user.sacraments?.confirmationParish || 'N/A';
  renderFieldLine('Holy Confirmation:', `Date: ${cDate}`);

  const mDate = user.sacraments?.marriageDate ? new Date(user.sacraments.marriageDate).toLocaleDateString('en-GB') : (user.weddingDate ? new Date(user.weddingDate).toLocaleDateString('en-GB') : 'N/A');
  const mParish = user.sacraments?.marriageParish || 'N/A';
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

  // --- Footer Page Numbers ---
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
};

// GET /api/users/:id/pdf — Option 1: Individual User Details PDF Report
const getUserPdfReport = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -otp -otpExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Authorization check
    if (req.user.role !== 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await generateComprehensiveUserPdfStream(user, res, false);
  } catch (err) {
    console.error('Error generating user PDF report:', err);
    res.status(500).json({ success: false, message: 'Failed to generate user PDF report: ' + err.message });
  }
};

// GET /api/users/export/pdf — Option 2: Export All Users PDF Report
const getAllUsersPdfReport = async (req, res) => {
  try {
    const users = await User.find({}).select('-passwordHash -otp -otpExpires').sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=All_Users_Report_${Date.now()}.pdf`);

    doc.pipe(res);

    const pageWidth = 595.28;
    const margin = 30;
    const contentWidth = pageWidth - margin * 2;

    // Header Accent Bar
    doc.rect(margin, 30, contentWidth, 5).fill('#1e3a8a');

    // Title / Header Banner
    doc.fillColor('#1e3a8a').fontSize(20).font('Helvetica-Bold').text("St. John de Britto's Church", margin, 42, { align: 'center', width: contentWidth });
    doc.fillColor('#b45309').fontSize(10).font('Helvetica-Bold').text("Kalayarkoil — All Registered Members Master Report", margin, 66, { align: 'center', width: contentWidth });
    doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text(`Total Members: ${users.length} | Generated On: ${new Date().toLocaleString('en-GB')}`, margin, 80, { align: 'center', width: contentWidth });

    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(margin, 95).lineTo(pageWidth - margin, 95).stroke();

    // Table Header
    const drawTableHeader = (y) => {
      doc.rect(margin, y, contentWidth, 22).fill('#1e3a8a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('#', margin + 5, y + 6, { width: 25 });
      doc.text('Name', margin + 30, y + 6, { width: 110 });
      doc.text('Phone', margin + 145, y + 6, { width: 85 });
      doc.text('Email / ID', margin + 235, y + 6, { width: 120 });
      doc.text('Sub-Station', margin + 360, y + 6, { width: 85 });
      doc.text('Role', margin + 450, y + 6, { width: 40 });
      doc.text('Status', margin + 495, y + 6, { width: 40 });
    };

    let currentY = 105;
    drawTableHeader(currentY);
    currentY += 24;

    users.forEach((u, idx) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 36;
        drawTableHeader(currentY);
        currentY += 24;
      }

      const bgColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(margin, currentY, contentWidth, 20).fill(bgColor);

      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      doc.text(String(idx + 1), margin + 5, currentY + 5, { width: 25 });
      doc.fillColor('#0f172a').font('Helvetica-Bold');
      doc.text(u.name || 'N/A', margin + 30, currentY + 5, { width: 110, height: 12, ellipsis: true });
      doc.fillColor('#334155').font('Helvetica');
      doc.text(u.phone || 'N/A', margin + 145, currentY + 5, { width: 85 });
      doc.text(u.email || u.parishMemberId || '—', margin + 235, currentY + 5, { width: 120, height: 12, ellipsis: true });
      doc.text(u.subStation || 'Main Parish', margin + 360, currentY + 5, { width: 85, height: 12, ellipsis: true });

      doc.fillColor(u.role === 'admin' ? '#dc2626' : '#2563eb').font('Helvetica-Bold');
      doc.text(u.role?.toUpperCase() || 'USER', margin + 450, currentY + 5, { width: 40 });

      const statusText = u.isSuspended ? 'Suspended' : (u.isActive ? 'Active' : 'Inactive');
      const statusColor = u.isSuspended ? '#dc2626' : (u.isActive ? '#16a34a' : '#64748b');
      doc.fillColor(statusColor).font('Helvetica-Bold');
      doc.text(statusText, margin + 495, currentY + 5, { width: 40 });

      currentY += 21;
    });

    // Page Numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(margin, 775).lineTo(pageWidth - margin, 775).stroke();
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text(
        `St. John de Britto's Church, Kalayarkoil — All Registered Members Master Report | Page ${i + 1} of ${range.count}`,
        margin,
        782,
        { align: 'center', width: contentWidth }
      );
    }

    doc.end();
  } catch (err) {
    console.error('Error generating all users PDF report:', err);
    res.status(500).json({ success: false, message: 'Failed to generate all users PDF report: ' + err.message });
  }
};

// GET /api/users/member-id-format — admin
const getMemberIdFormatInfo = async (req, res) => {
  try {
    const { getMemberIdFormat } = require('../services/memberIdService');
    const info = getMemberIdFormat();
    res.json({ success: true, ...info });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/update-member-id-format — admin
const updateMemberIdFormat = async (req, res) => {
  try {
    const { regenerateAllMemberIds } = require('../services/memberIdService');
    const { prefix, padLength, familyPrefix, familyPadLength } = req.body;
    if (!prefix || !prefix.trim()) {
      return res.status(400).json({ success: false, message: 'Member ID prefix is required (e.g. SJDB_M)' });
    }
    const result = await regenerateAllMemberIds(
      prefix, 
      padLength || 2, 
      familyPrefix || 'SJDB_FAM-', 
      familyPadLength || 2
    );
    res.json({ 
      success: true, 
      message: `Successfully updated format (Member: "${result.newFormat}", Family: "${result.newFamilyFormat}") for all users`, 
      ...result 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/lookup/scan?code=... — admin / lookup
const lookupUserByQr = async (req, res) => {
  try {
    const raw = req.query.code || '';
    if (!raw || !raw.trim()) {
      return res.status(400).json({ success: false, message: 'Scan code or text is required' });
    }

    const cleanRaw = raw.trim();
    let user = null;

    // 1. Try matching Member ID in text (e.g. SJDB_M03 or Member ID: SJDB_M03)
    const memberIdMatch = cleanRaw.match(/[A-Za-z0-9_]+_M\d+/i) || cleanRaw.match(/Member ID:\s*([^\s\n]+)/i);
    if (memberIdMatch) {
      const targetId = memberIdMatch[1] || memberIdMatch[0];
      user = await User.findOne({ parishMemberId: new RegExp(`^${targetId}$`, 'i') });
    }

    // 2. Try matching MongoDB ObjectId (24 hex chars)
    if (!user) {
      const mongoIdMatch = cleanRaw.match(/[a-fA-F0-9]{24}/);
      if (mongoIdMatch) {
        user = await User.findById(mongoIdMatch[0]);
      }
    }

    // 3. Try exact/case-insensitive search by parishMemberId, email, phone, or name
    if (!user) {
      user = await User.findOne({
        $or: [
          { parishMemberId: new RegExp(`^${cleanRaw}$`, 'i') },
          { email: cleanRaw.toLowerCase() },
          { phone: cleanRaw },
          { name: new RegExp(cleanRaw, 'i') }
        ]
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'No member found matching scanned code/ID.' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pdfReportUrl = `${baseUrl}/api/users/${user._id}/pdf`;

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        parishMemberId: user.parishMemberId || 'N/A',
        phone: user.phone || 'N/A',
        email: user.email || 'N/A',
        dob: user.dob ? new Date(user.dob).toLocaleDateString('en-GB') : 'N/A',
        gender: user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not Specified',
        address: user.address || 'N/A',
        role: (user.role || 'user').toUpperCase(),
        isActive: user.isActive,
        isSuspended: user.isSuspended,
        statusText: user.isSuspended ? 'Suspended' : (user.isActive ? 'Active' : 'Inactive'),
        createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A',
        lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-GB') : 'Never',
        pdfReportUrl
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lookup failed: ' + err.message });
  }
};

// GET /api/users/member-report/:token — Secure QR Scan Web Verification
const getMemberReportByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'Report token is required' });
    }

    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        tokenExpired: true,
        message: 'Invalid or expired member report link. Please request an updated report.'
      });
    }

    if (decoded.type !== 'member_report' || !decoded.userId) {
      return res.status(400).json({ success: false, message: 'Invalid report token payload' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member record not found in system' });
    }

    // Security & Access Control Check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        requireLogin: true,
        message: 'Authentication required. Please log in with an authorized Parish account to access member records.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isAdminOrStaff = ['admin', 'priest', 'staff'].includes(userRole);
    const isSelf = req.user._id.toString() === user._id.toString();

    if (!isAdminOrStaff && !isSelf) {
      return res.status(403).json({
        success: false,
        accessDenied: true,
        message: 'Access restricted. Only authorized parish administrators or the member themselves can view this report.'
      });
    }

    const pdfUrl = `/api/users/${user._id}/pdf`;
    const tokenPdfUrl = `/api/users/member-report/${token}/pdf`;

    res.json({
      success: true,
      member: {
        _id: user._id,
        name: user.name || 'N/A',
        parishMemberId: user.parishMemberId || 'N/A',
        phone: user.phone || 'N/A',
        email: user.email || 'N/A',
        familyName: user.familyName || 'N/A',
        roleInFamily: user.roleInFamily || 'N/A',
        dob: user.dob ? new Date(user.dob).toLocaleDateString('en-GB') : 'N/A',
        gender: user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not Specified',
        address: user.address || 'N/A',
        subStation: user.subStation || 'Kalayarkoil (Main Parish)',
        role: (user.role || 'user').toUpperCase(),
        isActive: user.isActive,
        isSuspended: user.isSuspended,
        statusText: user.isSuspended ? 'Suspended' : (user.isActive ? 'Active' : 'Inactive'),
        createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A',
        lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-GB') : 'Never'
      },
      pdfUrl,
      tokenPdfUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Report lookup error: ' + err.message });
  }
};

// GET /api/users/member-report/:token/pdf — Direct PDF Download Stream for Scanned Devices
const getMemberReportPdfByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'Report token is required' });
    }

    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token.trim(), process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired member report link.' });
    }

    if (decoded.type !== 'member_report' || !decoded.userId) {
      return res.status(400).json({ success: false, message: 'Invalid report token payload' });
    }

    const user = await User.findById(decoded.userId).select('-passwordHash -otp -otpExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member record not found' });
    }

    // Security & Access Control Check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        requireLogin: true,
        message: 'Authentication required. Please log in with an authorized Parish account to download member records.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isAdminOrStaff = ['admin', 'priest', 'staff'].includes(userRole);
    const isSelf = req.user._id.toString() === user._id.toString();

    if (!isAdminOrStaff && !isSelf) {
      return res.status(403).json({
        success: false,
        accessDenied: true,
        message: 'Access restricted. Only authorized parish administrators or the member themselves can download this report.'
      });
    }

    await generateComprehensiveUserPdfStream(user, res, true);
  } catch (err) {
    res.status(500).json({ success: false, message: 'PDF Download error: ' + err.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateProfile,
  updateUser,
  deleteUser,
  changePassword,
  updateSettings,
  getUserPdfReport,
  getAllUsersPdfReport,
  getMemberIdFormatInfo,
  updateMemberIdFormat,
  lookupUserByQr,
  getMemberReportByToken,
  getMemberReportPdfByToken,
  getFamilyIdByName,
  getExistingFamilies
};

