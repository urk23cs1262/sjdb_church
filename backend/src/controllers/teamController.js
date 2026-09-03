const TeamMember = require('../models/TeamMember');
const fs = require('fs');

const INITIAL_TEAM = [
  {
    name: 'Rev. Fr. John Peter',
    role: 'Parish Priest',
    department: 'Leadership',
    badge: 'Parish Priest',
    description: 'Leading our parish with faith, compassion, and dedicated pastoral service.',
    email: 'johnpeter@sjdbchurch.org',
    phone: '+91 98765 43210',
    order: 1,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Rev. Fr. Michael',
    role: 'Assistant Priest',
    department: 'Leadership',
    badge: 'Assistant Priest',
    description: 'Supports pastoral care, Mass celebrations, sacraments, and youth ministry.',
    email: 'michael@sjdbchurch.org',
    phone: '+91 98765 43211',
    order: 2,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Maria Joseph',
    role: 'Parish Secretary',
    department: 'Administration',
    badge: 'Administration',
    description: 'Handles parish records, registrations, certificates, and office administration.',
    email: 'secretary@sjdbchurch.org',
    phone: '+91 98765 43212',
    order: 3,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'John David',
    role: 'Youth Ministry Coordinator',
    department: 'Ministries',
    badge: 'Coordinator',
    description: 'Coordinates youth programs, spiritual retreats, and community service activities.',
    email: 'youth@sjdbchurch.org',
    phone: '+91 98765 43213',
    order: 4,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Maria Rose',
    role: 'Choir Director & Lead Vocalist',
    department: 'Choir Team',
    badge: 'Choir Leader',
    description: 'Leads the church choir, conducts weekly choir practice, and selects liturgical hymns.',
    email: 'choir@sjdbchurch.org',
    phone: '+91 98765 43214',
    order: 5,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Antony Raj',
    role: 'Parish Organist & Keyboardist',
    department: 'Choir Team',
    badge: 'Keyboardist',
    description: 'Plays keyboard and pipe organ during Sunday Mass, choir practices, and feast celebrations.',
    email: 'keyboard@sjdbchurch.org',
    phone: '+91 98765 43230',
    order: 6,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Francis Xavier',
    role: 'Lead Guitarist & Rhythm Instrumentalist',
    department: 'Choir Team',
    badge: 'Guitarist',
    description: 'Provides acoustic and electric guitar accompaniment for choir singing and youth Masses.',
    email: 'guitar@sjdbchurch.org',
    phone: '+91 98765 43231',
    order: 7,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'S. Susairaj',
    role: 'Thalaivar (President / தலைவர்)',
    department: 'St. Vincent de Paul Sabai',
    badge: 'Thalaivar',
    description: 'Leads St. Vincent de Paul Society in charitable distribution, poor aid, and sick visits.',
    email: 'vdp.thalaivar@sjdbchurch.org',
    phone: '+91 98765 43240',
    order: 8,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'A. Savarimuthu',
    role: 'Thunai-Thalaivar (Vice President / துணை தலைவர்)',
    department: 'St. Vincent de Paul Sabai',
    badge: 'Thunai-Thalaivar',
    description: 'Coordinates emergency assistance, education sponsorship, and monthly rice distribution.',
    email: 'vdp.vp@sjdbchurch.org',
    phone: '+91 98765 43241',
    order: 9,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'K. Lourdu Mary',
    role: 'Seyalalar (Secretary / செயலாளர்)',
    department: 'St. Vincent de Paul Sabai',
    badge: 'Seyalalar',
    description: 'Maintains records of beneficiary families, meeting minutes, and relief project logs.',
    email: 'vdp.sec@sjdbchurch.org',
    phone: '+91 98765 43242',
    order: 10,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'M. Michael',
    role: 'Porulalar (Treasurer / பொருளாளர்)',
    department: 'St. Vincent de Paul Sabai',
    badge: 'Porulalar',
    description: 'Manages society charity funds, secret box collections, and financial accounting.',
    email: 'vdp.treasurer@sjdbchurch.org',
    phone: '+91 98765 43243',
    order: 11,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Paul Raj',
    role: 'Catechism Coordinator',
    department: 'Ministries',
    badge: 'Sunday School',
    description: 'Oversees Sunday School classes, faith formation, and Holy Communion prep.',
    email: 'catechism@sjdbchurch.org',
    phone: '+91 98765 43215',
    order: 6,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Joseph',
    role: 'Altar Servers Coordinator',
    department: 'Ministries',
    badge: 'Liturgical Guide',
    description: 'Guides and trains altar servers during Holy Mass and special liturgical feasts.',
    email: 'altarservers@sjdbchurch.org',
    phone: '+91 98765 43216',
    order: 7,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Antony',
    role: 'Parish Council President',
    department: 'Parish Council',
    badge: 'Council President',
    description: 'Leads the parish council executive team in parish development and governance.',
    email: 'council.president@sjdbchurch.org',
    phone: '+91 98765 43217',
    order: 8,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'David',
    role: 'Parish Council Vice President',
    department: 'Parish Council',
    badge: 'Vice President',
    description: 'Assists council leadership and oversees parish infrastructure projects.',
    email: 'council.vp@sjdbchurch.org',
    phone: '+91 98765 43218',
    order: 9,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Maria',
    role: 'Parish Council Secretary',
    department: 'Parish Council',
    badge: 'Council Secretary',
    description: 'Maintains parish council meeting minutes and administrative documentation.',
    email: 'council.sec@sjdbchurch.org',
    phone: '+91 98765 43219',
    order: 10,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  },
  {
    name: 'Joseph Samuel',
    role: 'Parish Council Treasurer',
    department: 'Parish Council',
    badge: 'Treasurer',
    description: 'Oversees parish financial management, accounting, and annual audits.',
    email: 'treasurer@sjdbchurch.org',
    phone: '+91 98765 43220',
    order: 11,
    isActive: true,
    socialLinks: { facebook: '', instagram: '', linkedin: '' }
  }
];

// GET /api/team — public (active members only)
const getPublicTeamMembers = async (req, res) => {
  try {
    const members = await TeamMember.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, count: members.length, members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/team/admin — admin (all members including hidden)
const getAllTeamMembers = async (req, res) => {
  try {
    const members = await TeamMember.find({}).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, count: members.length, members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/team — admin (create)
const createTeamMember = async (req, res) => {
  try {
    const { name, role, department, subGroup, assignedClass, qualification, yearsOfService, badge, description, email, phone, socialLinks, order, isActive } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Name and role are required' });
    }

    let image = req.body.image || '';
    if (req.file) {
      try {
        const { uploadToGridFS } = require('../services/gridfsService');
        const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        if (buffer) {
          const fileInfo = await uploadToGridFS(buffer, req.file.originalname || 'team.jpg', req.file.mimetype || 'image/jpeg');
          image = fileInfo.url;
        }
      } catch (e) {
        console.error('Error uploading team photo to GridFS:', e.message);
      }
    }

    let parsedSocials = { facebook: '', instagram: '', linkedin: '' };
    if (typeof socialLinks === 'string') {
      try { parsedSocials = JSON.parse(socialLinks); } catch (e) {}
    } else if (typeof socialLinks === 'object' && socialLinks !== null) {
      parsedSocials = socialLinks;
    }

    const maxOrderDoc = await TeamMember.findOne().sort({ order: -1 });
    const nextOrder = order !== undefined ? Number(order) : ((maxOrderDoc?.order || 0) + 1);

    const member = await TeamMember.create({
      name,
      role,
      department: department || 'Leadership',
      subGroup: subGroup || '',
      assignedClass: assignedClass || '',
      qualification: qualification || '',
      yearsOfService: yearsOfService || '',
      badge,
      description,
      email,
      phone,
      image,
      socialLinks: parsedSocials,
      order: nextOrder,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true
    });

    res.status(201).json({ success: true, message: 'Team member created successfully', member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/team/:id — admin (update)
const updateTeamMember = async (req, res) => {
  try {
    const { name, role, department, subGroup, assignedClass, qualification, yearsOfService, badge, description, email, phone, socialLinks, order, isActive } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (subGroup !== undefined) updateData.subGroup = subGroup;
    if (assignedClass !== undefined) updateData.assignedClass = assignedClass;
    if (qualification !== undefined) updateData.qualification = qualification;
    if (yearsOfService !== undefined) updateData.yearsOfService = yearsOfService;
    if (badge !== undefined) updateData.badge = badge;
    if (description !== undefined) updateData.description = description;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (order !== undefined) updateData.order = Number(order);
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

    if (socialLinks !== undefined) {
      if (typeof socialLinks === 'string') {
        try { updateData.socialLinks = JSON.parse(socialLinks); } catch (e) {}
      } else if (typeof socialLinks === 'object' && socialLinks !== null) {
        updateData.socialLinks = socialLinks;
      }
    }

    if (req.file) {
      try {
        const { uploadToGridFS } = require('../services/gridfsService');
        const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        if (buffer) {
          const fileInfo = await uploadToGridFS(buffer, req.file.originalname || 'team.jpg', req.file.mimetype || 'image/jpeg');
          updateData.image = fileInfo.url;
        }
      } catch (e) {
        console.error('Error uploading team photo to GridFS:', e.message);
      }
    } else if (req.body.image !== undefined) {
      updateData.image = req.body.image;
    }

    const member = await TeamMember.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });

    res.json({ success: true, message: 'Team member updated', member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/team/:id — admin (permanent database deletion)
const deleteTeamMember = async (req, res) => {
  try {
    const deleted = await TeamMember.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Team member not found' });
    res.json({ success: true, message: 'Team member permanently deleted from database' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete member: ' + err.message });
  }
};

// PUT /api/team/:id/toggle — admin
const toggleTeamMemberActive = async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
    
    member.isActive = !member.isActive;
    await member.save();

    res.json({ success: true, message: `Member ${member.isActive ? 'activated' : 'hidden'}`, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/team/reorder — admin
const reorderTeamMembers = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, order }
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: 'Items array is required' });

    for (const item of items) {
      if (item.id && item.order !== undefined) {
        await TeamMember.findByIdAndUpdate(item.id, { order: Number(item.order) });
      }
    }

    const members = await TeamMember.find({}).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, message: 'Display order updated successfully', members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/team/all/members — admin (delete all members)
const deleteAllTeamMembers = async (req, res) => {
  try {
    const result = await TeamMember.deleteMany({});
    res.json({ success: true, message: `Deleted all ${result.deletedCount} team members`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/team/category/:category — admin (delete members in category)
const deleteTeamMembersByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    if (!category) return res.status(400).json({ success: false, message: 'Category is required' });

    const result = await TeamMember.deleteMany({ department: new RegExp(`^${category.trim()}$`, 'i') });
    res.json({ success: true, message: `Deleted ${result.deletedCount} members from "${category}"`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/team/reset — admin (reset back to default team members)
const resetDefaultTeam = async (req, res) => {
  try {
    await TeamMember.deleteMany({});
    const members = await TeamMember.insertMany(INITIAL_TEAM);
    res.json({ success: true, message: `Reset team back to default ${members.length} members`, members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPublicTeamMembers,
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  toggleTeamMemberActive,
  reorderTeamMembers,
  deleteAllTeamMembers,
  deleteTeamMembersByCategory,
  resetDefaultTeam
};
