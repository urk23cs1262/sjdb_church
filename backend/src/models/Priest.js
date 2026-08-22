const mongoose = require('mongoose');

const priestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  designation: { type: String, required: true, enum: ['Parish Priest', 'Assistant Priest', 'Former Parish Priest', 'Deacon', 'Other'] },
  photo: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  phone: { type: String },
  email: { type: String },
  whatsapp: { type: String },
  bio: { type: String },
  isCurrent: { type: Boolean, default: false },
  order: { type: Number, default: 99 },
}, { timestamps: true });

module.exports = mongoose.model('Priest', priestSchema);
