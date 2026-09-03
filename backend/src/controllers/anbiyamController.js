const AnbiyamGroup = require('../models/AnbiyamGroup');
const AnbiyamMember = require('../models/AnbiyamMember');

// ── Public Website API — Safe / Non-sensitive data only ─────────────────────
const getPublicAnbiyams = async (req, res) => {
  try {
    const groups = await AnbiyamGroup.find({ isActive: true }).sort({ name: 1 });
    
    // Enrich each group with accurate public aggregated counts
    const publicList = await Promise.all(groups.map(async (group) => {
      const members = await AnbiyamMember.find({ anbiyam: group._id, isActive: true }).select('numberOfFamilyMembers');
      const totalMembers = members.length;
      const totalFamilies = members.reduce((sum, m) => sum + (m.numberOfFamilyMembers || 1), 0);

      return {
        _id: group._id,
        name: group.name,
        patronSaint: group.patronSaint || '',
        description: group.description || '',
        meetingDay: group.meetingDay || '',
        meetingTime: group.meetingTime || '',
        meetingFrequency: group.meetingFrequency || 'Monthly',
        meetingVenue: group.meetingVenue || '',
        image: group.image || '',
        leaderName: group.leaderName || '',
        viceLeaderName: group.viceLeaderName || '',
        secretaryName: group.secretaryName || '',
        contactPerson: group.contactPerson || '',
        totalFamilies,
        totalMembers
      };
    }));

    res.json({ success: true, anbiyams: publicList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Anbiyam Groups Management ────────────────────────────────────────
const getAdminAnbiyams = async (req, res) => {
  try {
    const groups = await AnbiyamGroup.find().sort({ name: 1 });
    const groupsWithStats = await Promise.all(groups.map(async (g) => {
      const memberCount = await AnbiyamMember.countDocuments({ anbiyam: g._id });
      const activeCount = await AnbiyamMember.countDocuments({ anbiyam: g._id, isActive: true });
      return {
        ...g.toObject(),
        memberCount,
        activeCount
      };
    }));
    res.json({ success: true, anbiyams: groupsWithStats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createAnbiyamGroup = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.path.replace(/\\/g, '/');
    const group = await AnbiyamGroup.create(data);
    res.status(201).json({ success: true, group });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateAnbiyamGroup = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.path.replace(/\\/g, '/');
    const group = await AnbiyamGroup.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!group) return res.status(404).json({ success: false, message: 'Anbiyam group not found' });
    res.json({ success: true, group });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteAnbiyamGroup = async (req, res) => {
  try {
    await AnbiyamGroup.findByIdAndDelete(req.params.id);
    // Unassign members or soft delete
    await AnbiyamMember.deleteMany({ anbiyam: req.params.id });
    res.json({ success: true, message: 'Anbiyam group and associated members deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Anbiyam Members Management ───────────────────────────────────────
const getAnbiyamMembers = async (req, res) => {
  try {
    const { anbiyamId, role, gender, status, search, page = 1, limit = 100 } = req.query;
    const query = {};

    if (anbiyamId) query.anbiyam = anbiyamId;
    if (role) query.role = role;
    if (gender) query.gender = gender;
    if (status) query.isActive = status === 'active';
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } },
        { familyId: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { familyName: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await AnbiyamMember.countDocuments(query);
    const members = await AnbiyamMember.find(query)
      .populate('anbiyam', 'name areaStreetZone')
      .sort({ fullName: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createAnbiyamMember = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.profilePhoto = req.file.path.replace(/\\/g, '/');
    const member = await AnbiyamMember.create(data);
    const populated = await AnbiyamMember.findById(member._id).populate('anbiyam', 'name');
    res.status(201).json({ success: true, member: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateAnbiyamMember = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.profilePhoto = req.file.path.replace(/\\/g, '/');
    const member = await AnbiyamMember.findByIdAndUpdate(req.params.id, data, { new: true }).populate('anbiyam', 'name');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, member });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteAnbiyamMember = async (req, res) => {
  try {
    await AnbiyamMember.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Member deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const transferAnbiyamMember = async (req, res) => {
  try {
    const { targetAnbiyamId } = req.body;
    if (!targetAnbiyamId) return res.status(400).json({ success: false, message: 'Target Anbiyam ID is required' });

    const member = await AnbiyamMember.findByIdAndUpdate(
      req.params.id,
      { anbiyam: targetAnbiyamId },
      { new: true }
    ).populate('anbiyam', 'name');

    res.json({ success: true, message: `Member transferred to ${member.anbiyam.name}`, member });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const recordAttendance = async (req, res) => {
  try {
    const { memberIds, date, status, notes } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: 'memberIds array is required' });
    }

    const meetingDate = date ? new Date(date) : new Date();

    await Promise.all(memberIds.map(async (id) => {
      await AnbiyamMember.findByIdAndUpdate(id, {
        lastMeetingAttended: status === 'Present' ? meetingDate : undefined,
        $push: {
          attendanceHistory: {
            date: meetingDate,
            status: status || 'Present',
            notes: notes || ''
          }
        }
      });
    }));

    res.json({ success: true, message: `Attendance updated for ${memberIds.length} member(s)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Dashboard Statistics ─────────────────────────────────────────────
const getAnbiyamStats = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const todayDate = now.getDate();

    const [
      totalAnbiyams,
      totalMembers,
      maleMembers,
      femaleMembers,
      activeMembers,
      inactiveMembers,
      allMembers
    ] = await Promise.all([
      AnbiyamGroup.countDocuments({ isActive: true }),
      AnbiyamMember.countDocuments(),
      AnbiyamMember.countDocuments({ gender: 'male' }),
      AnbiyamMember.countDocuments({ gender: 'female' }),
      AnbiyamMember.countDocuments({ isActive: true }),
      AnbiyamMember.countDocuments({ isActive: false }),
      AnbiyamMember.find().select('fullName dob weddingDate memberId phone anbiyam').populate('anbiyam', 'name')
    ]);

    let youthMembers = 0;
    let seniorMembers = 0;
    const todayBirthdays = [];
    const upcomingAnniversaries = [];

    allMembers.forEach(m => {
      // Age calculation
      if (m.dob) {
        const birthDate = new Date(m.dob);
        if (!isNaN(birthDate.getTime())) {
          let age = now.getFullYear() - birthDate.getFullYear();
          const monthDiff = now.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age >= 13 && age <= 30) youthMembers++;
          if (age >= 60) seniorMembers++;

          // Today Birthday check
          if (birthDate.getMonth() === currentMonth && birthDate.getDate() === todayDate) {
            todayBirthdays.push(m);
          }
        }
      }

      // Wedding Anniversary check (current month)
      if (m.weddingDate) {
        const wDate = new Date(m.weddingDate);
        if (!isNaN(wDate.getTime()) && wDate.getMonth() === currentMonth) {
          upcomingAnniversaries.push(m);
        }
      }
    });

    res.json({
      success: true,
      stats: {
        totalAnbiyams,
        totalMembers,
        maleMembers,
        femaleMembers,
        youthMembers,
        seniorMembers,
        activeMembers,
        inactiveMembers,
        todayBirthdaysCount: todayBirthdays.length,
        upcomingAnniversariesCount: upcomingAnniversaries.length
      },
      todayBirthdays,
      upcomingAnniversaries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPublicAnbiyams,
  getAdminAnbiyams,
  createAnbiyamGroup,
  updateAnbiyamGroup,
  deleteAnbiyamGroup,
  getAnbiyamMembers,
  createAnbiyamMember,
  updateAnbiyamMember,
  deleteAnbiyamMember,
  transferAnbiyamMember,
  recordAttendance,
  getAnbiyamStats
};
