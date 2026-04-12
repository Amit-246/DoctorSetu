const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true, match: /^[0-9]{10}$/ },
  name: String,
  age: Number,
  gender: String,
  photo: String,
  profilePhoto: String,
  qualification: String,
  speciality: String,
  experience: { type: Number, default: 0 },
  availabilityStart: String,
  availabilityEnd: String,
  isAvailable: { type: Boolean, default: true },
  permanentAddress: String,
  presentAddress: String,
  isProfileComplete: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date
}, { timestamps: true });

module.exports = mongoose.model('Nurse', nurseSchema);
