const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    match: /^[0-9]{10}$/
  },
  name: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  email: {
    type: String
  },
  relation: {
    type: String,
    enum: ['Self', 'Parent', 'Child', 'Spouse', 'Sibling', 'Other'],
    default: 'Self'
  },
  address: String,
  bloodGroup: String
}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);
