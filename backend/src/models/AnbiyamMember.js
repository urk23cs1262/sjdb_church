const mongoose = require('mongoose');

const anbiyamMemberSchema = new mongoose.Schema({
  // Personal Information
  fullName: { type: String, required: true, trim: true },
  familyId: { type: String, trim: true },
  memberId: { type: String, unique: true, required: true }, // e.g. ANB-2026-0001
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  dob: { type: Date },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  familyName: { type: String, trim: true },
  baptismName: { type: String, trim: true },
  profilePhoto: { type: String, trim: true },
  occupation: { type: String, trim: true },
  bloodGroup: { type: String, trim: true },
  notes: { type: String, trim: true },

  // Church Information
  anbiyam: { type: mongoose.Schema.Types.ObjectId, ref: 'AnbiyamGroup', required: true },
  role: { 
    type: String, 
    enum: [
      'Leader', 
      'Vice Leader', 
      'Secretary', 
      'Joint Secretary', 
      'Treasurer', 
      'Prayer Coordinator', 
      'Youth Coordinator', 
      'Choir Representative', 
      'Catechism Representative', 
      'Liturgy Representative', 
      'Volunteer', 
      'Member'
    ], 
    default: 'Member' 
  },
  dateJoined: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },

  // Family Details
  headOfFamily: { type: String, trim: true },
  spouseName: { type: String, trim: true },
  numberOfFamilyMembers: { type: Number, default: 1 },
  weddingAnniversary: { type: Date },
  emergencyContact: { type: String, trim: true },

  // Attendance History
  lastMeetingAttended: { type: Date },
  attendanceHistory: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Present', 'Absent'], default: 'Present' },
    notes: { type: String, trim: true }
  }]
}, { timestamps: true });

// Auto-generate memberId if missing before validation
anbiyamMemberSchema.pre('validate', async function(next) {
  if (!this.memberId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('AnbiyamMember').countDocuments();
    this.memberId = `ANB-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('AnbiyamMember', anbiyamMemberSchema);
