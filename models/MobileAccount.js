const mongoose = require('mongoose');

const mobileAccountSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    unique: true,
    match: /^[0-9]{10}$/
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'nurse', null],
    default: null
  },
  profileCompleted: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('MobileAccount', mobileAccountSchema);
