const express   = require('express');
const router    = express.Router();
const Appointment = require('../models/Appointment');
const nurseAuth = require('../middleware/nurseAuth');

// Get all appointments assigned to this nurse
router.get('/appointments', nurseAuth, async (req, res) => {
  try {
    const apts = await Appointment.find({ nurseId: req.nurseId })
      .populate('patientId', 'name firstName lastName mobile age gender')
      .sort({ createdAt: -1 });
    res.json(apts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/appointments/:id/confirm', nurseAuth, async (req, res) => {
  try {
    const apt = await Appointment.findOne({ _id: req.params.id, nurseId: req.nurseId });
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });
    if (apt.status === 'confirmed') return res.status(400).json({ error: 'Already confirmed' });

    apt.status = 'confirmed';
    apt.confirmedAt = new Date();
    apt.autoConfirmTimer = new Date(Date.now() + 30000);
    await apt.save();
    res.json({ message: 'Confirmed', appointment: apt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/appointments/:id/cancel', nurseAuth, async (req, res) => {
  try {
    const apt = await Appointment.findOne({ _id: req.params.id, nurseId: req.nurseId });
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });
    if (apt.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
    if (apt.status === 'confirmed' && apt.autoConfirmTimer < new Date())
      return res.status(400).json({ error: 'Cannot cancel after 30 seconds of confirmation' });

    apt.status = 'cancelled';
    await apt.save();
    res.json({ message: 'Cancelled', appointment: apt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
