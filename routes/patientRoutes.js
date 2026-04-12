const express = require('express');
const router  = express.Router();
const Appointment  = require('../models/Appointment');
const Message      = require('../models/Message');
const Patient      = require('../models/Patient');
const Prescription = require('../models/Prescription');
const patientAuth  = require('../middleware/patientAuth');

// Get appointments — filtered by specific patientId if provided
router.get('/appointments', patientAuth, async (req, res) => {
  try {
    let ids;
    if (req.query.patientId) {
      ids = [req.query.patientId];
    } else {
      const patients = await Patient.find({ mobile: req.mobile }).select('_id');
      ids = patients.map(p => p._id);
    }

    const appointments = await Appointment.find({ patientId: { $in: ids } })
      .populate('patientId', 'name firstName lastName')
      .populate('doctorId', 'firstName lastName medicalDegree mobile profilePhoto presentAddress yearOfCompletion')
      .sort({ createdAt: -1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a pending appointment (patient side)
router.delete('/appointments/:id/cancel', patientAuth, async (req, res) => {
  try {
    const patients = await Patient.find({ mobile: req.mobile }).select('_id');
    const ids = patients.map(p => p._id.toString());

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (!ids.includes(appointment.patientId.toString()))
      return res.status(403).json({ error: 'Not authorized' });
    if (appointment.status !== 'pending')
      return res.status(400).json({ error: 'Only pending appointments can be cancelled' });

    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ message: 'Appointment cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages — filtered by specific patientId if provided
router.get('/messages', patientAuth, async (req, res) => {
  try {
    let ids;
    if (req.query.patientId) {
      ids = [req.query.patientId];
    } else {
      const patients = await Patient.find({ mobile: req.mobile }).select('_id');
      ids = patients.map(p => p._id);
    }

    const messages = await Message.find({ patientId: { $in: ids } })
      .populate('patientId', '_id')
      .populate('doctorId', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PRESCRIPTIONS ─────────────────────────────────────────────────
// GET prescriptions/reports — filtered by specific patientId if provided
router.get('/prescriptions', patientAuth, async (req, res) => {
  try {
    let ids;
    if (req.query.patientId) {
      ids = [req.query.patientId];
    } else {
      const patients = await Patient.find({ mobile: req.mobile }).select('_id');
      ids = patients.map(p => p._id);
    }

    // Collect from appointments (patient-uploaded reports)
    const appointments = await Appointment.find({
      patientId: { $in: ids },
      medicalReports: { $exists: true, $not: { $size: 0 } }
    })
      .populate('patientId', 'name firstName')
      .populate('doctorId',  'firstName lastName')
      .sort({ createdAt: -1 });

    const fromAppointments = [];
    appointments.forEach(apt => {
      (apt.medicalReports || []).forEach(filePath => {
        fromAppointments.push({
          _id:           `${apt._id}_${filePath}`,
          appointmentId: apt._id,
          patientId:     apt.patientId,
          doctorId:      apt.doctorId,
          type:          'report',
          uploadedBy:    'patient',
          filePath,
          label:         apt.healthProblem || 'Medical Report',
          createdAt:     apt.createdAt
        });
      });
    });

    // Collect doctor prescriptions from Prescription model
    const doctorRx = await Prescription.find({ patientId: { $in: ids } })
      .populate('patientId', 'name firstName')
      .populate('doctorId',  'firstName lastName')
      .sort({ createdAt: -1 });

    const all = [...fromAppointments, ...doctorRx]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(all);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
