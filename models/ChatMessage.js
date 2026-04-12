const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  senderRole:    { type: String, enum: ['doctor', 'patient'], required: true },
  senderId:      { type: mongoose.Schema.Types.ObjectId, required: true },
  senderName:    { type: String },
  message:       { type: String, required: true },
  duringCall:    { type: Boolean, default: true },  // false = post-call
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
