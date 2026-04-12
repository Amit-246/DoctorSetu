const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const authMiddleware = require('../middleware/auth');

router.post('/messages/send', authMiddleware, async (req, res) => {
  try {
    const { appointmentId, message, type } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const newMessage = await Message.create({
      appointmentId,
      doctorId: req.doctorId,
      patientId: appointment.patientId,
      type: type || 'general',
      message: message.trim()
    });

    res.json({ message: 'Message sent successfully', data: newMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/messages/:appointmentId', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      appointmentId: req.params.appointmentId,
      doctorId: req.doctorId
    }).sort({ createdAt: -1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
