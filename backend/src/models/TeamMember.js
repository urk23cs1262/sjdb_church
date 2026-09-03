const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  department: { 
    type: String, 
    enum: [
      'Leadership',
      'Administration',
      'Parish Council',
      'Catechism',
      'Youth Ministry',
      'Altar Servers',
      'Choir Team',
      'Society of St. Vincent de Paul (SSVP)',
      'Website Technical Team',
      'Volunteers',
      'Ministries',
      'St. Vincent de Paul Sabai'
    ],
    default: 'Leadership'
  },
  subGroup: { type: String, trim: true, default: '' }, // e.g. 'Leadership', 'Teachers', 'Support Team'
  assignedClass: { type: String, trim: true, default: '' }, // e.g. 'Class V', 'First Holy Communion'
  qualification: { type: String, trim: true, default: '' }, // e.g. 'M.A., B.Ed.'
  yearsOfService: { type: String, trim: true, default: '' }, // e.g. '5 Years'
  badge: { type: String, trim: true },
  description: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  image: { type: String, default: '' },
  socialLinks: {
    facebook: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    linkedin: { type: String, trim: true, default: '' }
  },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
