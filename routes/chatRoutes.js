const express     = require('express');
const router      = express.Router();
const ChatMessage = require('../models/ChatMessage');
const Appointment = require('../models/Appointment');
const authMiddleware  = require('../middleware/auth');
const patientAuth     = require('../middleware/patientAuth');

const POST_CALL_LIMIT = 15;

// ── DOCTOR: send chat message ──────────────────────────────
router.post('/chat/send', authMiddleware, async (req, res) => {
  try {
    const { appointmentId, message, duringCall } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const apt = await Appointment.findById(appointmentId).populate('doctorId', 'firstName lastName');
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });

    // Post-call limit check
    if (!duringCall) {
      const postCount = await ChatMessage.countDocuments({ appointmentId, duringCall: false });
      if (postCount >= POST_CALL_LIMIT)
        return res.status(400).json({ error: `Post-call message limit (${POST_CALL_LIMIT}) reached.` });
    }

    const name = apt.doctorId
      ? `Dr. ${apt.doctorId.firstName || ''} ${apt.doctorId.lastName || ''}`.trim()
      : 'Doctor';

    const msg = await ChatMessage.create({
      appointmentId, senderRole: 'doctor',
      senderId: req.doctorId, senderName: name,
      message: message.trim(), duringCall: !!duringCall
    });

    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DOCTOR: get chat history ───────────────────────────────
router.get('/chat/:appointmentId', authMiddleware, async (req, res) => {
  try {
    const msgs = await ChatMessage.find({ appointmentId: req.params.appointmentId })
      .sort({ createdAt: 1 });
    const postCount = msgs.filter(m => !m.duringCall).length;
    res.json({ messages: msgs, postCallCount: postCount, postCallLimit: POST_CALL_LIMIT });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATIENT: send chat message ─────────────────────────────
router.post('/chat/send', patientAuth, async (req, res) => {
  try {
    const { appointmentId, message, duringCall, senderName } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const apt = await Appointment.findById(appointmentId);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });

    if (!duringCall) {
      const postCount = await ChatMessage.countDocuments({ appointmentId, duringCall: false });
      if (postCount >= POST_CALL_LIMIT)
        return res.status(400).json({ error: `Post-call message limit (${POST_CALL_LIMIT}) reached.` });
    }

    const msg = await ChatMessage.create({
      appointmentId, senderRole: 'patient',
      senderId: apt.patientId, senderName: senderName || 'Patient',
      message: message.trim(), duringCall: !!duringCall
    });

    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATIENT: get chat history ──────────────────────────────
router.get('/chat/:appointmentId', patientAuth, async (req, res) => {
  try {
    const msgs = await ChatMessage.find({ appointmentId: req.params.appointmentId })
      .sort({ createdAt: 1 });
    const postCount = msgs.filter(m => !m.duringCall).length;
    res.json({ messages: msgs, postCallCount: postCount, postCallLimit: POST_CALL_LIMIT });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
