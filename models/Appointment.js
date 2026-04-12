const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  nurseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Nurse'
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  appointmentDate: Date,
  timeSlot: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  confirmedAt: Date,
  autoConfirmTimer: Date,

  // Step 1 — basic patient snapshot
  presentAddress: String,

  // Step 2 — medical details
  healthProblem: String,
  currentTreatment: String,
  medicalReports: [String],   // file paths

  // Step 3 — appointment type
  appointmentType: {
    type: String,
    enum: ['online', 'home_visit', 'offline', 'nurse_visit']
  }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
