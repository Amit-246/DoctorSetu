const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true, match: /^[0-9]{10}$/ },
  firstName: String,
  lastName: String,
  age: Number,
  gender: String,
  profilePhoto: String,
  medicalDegree: String,
  yearOfCompletion: Number,
  specializations: [{ type: String }],
  availabilityStart: String,
  availabilityEnd: String,
  appointmentTypes: [{ type: String, enum: ['online', 'home_visit', 'clinic'] }],
  aptTypeAvailability: {
    online:     { start: String, end: String },
    home_visit: { start: String, end: String },
    clinic:     { start: String, end: String }
  },
  clinicName: String,
  clinicAddress: String,
  clinicPhoto: String,
  permanentAddress: String,
  presentAddress: String,
  isProfileComplete: { type: Boolean, default: false },
  isVerified:        { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
