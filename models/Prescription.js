const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  patientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  type:          { type: String, enum: ['report', 'prescription'], default: 'report' },
  label:         { type: String },   // e.g. "Blood Test", "X-Ray", doctor's note title
  filePath:      { type: String },   // uploaded file path
  textContent:   { type: String },   // text prescription from doctor
  uploadedBy:    { type: String, enum: ['patient', 'doctor'], default: 'patient' }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
