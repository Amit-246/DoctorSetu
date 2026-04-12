const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const Appointment = require('../models/Appointment');
const Patient     = require('../models/Patient');
const patientAuth = require('../middleware/patientAuth');

const storage = multer.diskStorage({
  destination: './public/uploads/reports/',
  filename: (req, file, cb) => {
    cb(null, 'report-' + Date.now() + '-' + Math.round(Math.random()*1e6) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// Book appointment — 3-step data + unlimited reports
router.post('/book', patientAuth, upload.array('medicalReports'), async (req, res) => {
  try {
    const {
      // Step 1
      name, age, gender, presentAddress, relation, bloodGroup,
      // Step 2
      healthProblem, currentTreatment,
      // Step 3
      doctorId, appointmentType, appointmentDate, timeSlot
    } = req.body;

    if (!healthProblem || !appointmentType || !doctorId) {
      return res.status(400).json({ error: 'Health problem, appointment type and doctor are required' });
    }
    if (!appointmentDate) {
      return res.status(400).json({ error: 'Appointment date is required' });
    }
    const parsedDate = new Date(appointmentDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid appointment date' });
    }

    // Find existing patient profile by name, or create new one
    let patient = await Patient.findOne({ mobile: req.mobile, name });
    if (!patient) {
      patient = await Patient.create({
        mobile: req.mobile, name,
        age, gender, relation: relation || 'Self',
        address: presentAddress, bloodGroup
      });
    }

    const medicalReports = [
      ...(req.files || []).map(f => '/uploads/reports/' + f.filename),
      ...(Array.isArray(req.body.existingReportPaths)
            ? req.body.existingReportPaths
            : req.body.existingReportPaths ? [req.body.existingReportPaths] : [])
    ];

    const appointment = await Appointment.create({
      doctorId,
      patientId: patient._id,
      presentAddress,
      healthProblem,
      currentTreatment,
      medicalReports,
      appointmentType,
      appointmentDate: parsedDate,
      timeSlot: timeSlot || '',
      status: 'pending'
    });

    res.json({ message: 'Appointment booked successfully', appointment, patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all doctors list — filtered by appointment type if provided
router.get('/doctors', patientAuth, async (req, res) => {
  try {
    const Doctor = require('../models/Doctor');
    const filter = { isProfileComplete: true };
    if (req.query.type) filter.appointmentTypes = req.query.type;
    const doctors = await Doctor.find(filter)
      .select('firstName lastName medicalDegree profilePhoto yearOfCompletion specializations appointmentTypes aptTypeAvailability availabilityStart availabilityEnd clinicName clinicAddress clinicPhoto');
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search nurses by gender + time availability
router.get('/nurses', patientAuth, async (req, res) => {
  try {
    const Nurse = require('../models/Nurse');
    const { gender, time } = req.query;

    // Base filter: profile complete only
    const baseFilter = { isProfileComplete: true };
    if (gender && gender !== 'Any') baseFilter.gender = gender;

    const allNurses = await Nurse.find(baseFilter);

    if (!allNurses.length) return res.json([]);

    // If no time provided, return all
    if (!time) return res.json(allNurses);

    const selectedMins = parseTimeToMins(time);

    // Split into: within range, and outside range (fallback)
    const inRange  = allNurses.filter(n => {
      if (!n.availabilityStart || !n.availabilityEnd) return true; // no restriction set
      const start = parseTimeToMins(n.availabilityStart);
      const end   = parseTimeToMins(n.availabilityEnd);
      return selectedMins >= start && selectedMins <= end;
    });

    // Return in-range nurses; if none found, fall back to all nurses
    res.json(inRange.length ? inRange : allNurses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function parseTimeToMins(timeStr) {
  if (!timeStr) return 0;
  // Handles "09:00 AM", "09:00", "9:00 AM"
  const parts = timeStr.trim().split(' ');
  const [h, m] = parts[0].split(':').map(Number);
  const ap = parts[1] ? parts[1].toUpperCase() : null;
  let hours = h;
  if (ap === 'PM' && h !== 12) hours += 12;
  if (ap === 'AM' && h === 12) hours = 0;
  return hours * 60 + (m || 0);
}

// Book nurse visit
router.post('/book-nurse', patientAuth, async (req, res) => {
  try {
    const Nurse  = require('../models/Nurse');
    const { name, age, gender, relation, bloodGroup, presentAddress,
            healthProblem, nurseId, timeSlot, nurseGender } = req.body;

    if (!healthProblem || !nurseId || !timeSlot) {
      return res.status(400).json({ error: 'Health problem, nurse and time slot are required' });
    }

    let patient = await Patient.findOne({ mobile: req.mobile, name });
    if (!patient) {
      patient = await Patient.create({
        mobile: req.mobile, name, age, gender,
        relation: relation || 'Self', address: presentAddress, bloodGroup
      });
    }

    const appointment = await Appointment.create({
      patientId:       patient._id,
      nurseId,
      presentAddress,
      healthProblem,
      appointmentType: 'nurse_visit',
      appointmentDate: new Date(),
      timeSlot,
      status: 'pending'
    });

    res.json({ message: 'Nurse visit booked successfully', appointment, patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
