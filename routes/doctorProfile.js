const express  = require('express');
const router   = express.Router();
const Doctor   = require('../models/Doctor');
const MobileAccount = require('../models/MobileAccount');
const authMiddleware = require('../middleware/auth');
const multer   = require('multer');
const path     = require('path');

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, 'doctor-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Accept both profilePhoto and clinicPhoto
const uploadFields = upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'clinicPhoto',  maxCount: 1 }
]);

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctorId).select('-otp -otpExpiry');
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/profile', authMiddleware, uploadFields, async (req, res) => {
  try {
    const {
      firstName, lastName, age, gender,
      medicalDegree, yearOfCompletion,
      permanentAddress, presentAddress,
      availabilityStart, availabilityEnd,
      appointmentTypes,
      aptTypeAvailability,
      specializations,
      clinicName, clinicAddress
    } = req.body;

    // Validate max 8-hour availability
    if (availabilityStart && availabilityEnd) {
      const diff = timeDiffHours(availabilityStart, availabilityEnd);
      if (diff > 8) return res.status(400).json({ error: 'Availability cannot exceed 8 hours per day.' });
      if (diff <= 0) return res.status(400).json({ error: 'End time must be after start time.' });
    }

    const parsedTypes = safeParseJSON(appointmentTypes, []);
    const parsedAptAvail = safeParseJSON(aptTypeAvailability, {});
    const parsedSpecs = safeParseJSON(specializations, []);

    if (parsedSpecs.length > 5) return res.status(400).json({ error: 'Maximum 5 specializations allowed.' });

    const updateData = {
      firstName, lastName, age, gender,
      medicalDegree, yearOfCompletion,
      permanentAddress, presentAddress,
      availabilityStart, availabilityEnd,
      appointmentTypes: parsedTypes,
      aptTypeAvailability: parsedAptAvail,
      specializations: parsedSpecs,
      clinicName:    parsedTypes.includes('clinic') ? clinicName    : undefined,
      clinicAddress: parsedTypes.includes('clinic') ? clinicAddress : undefined,
      isProfileComplete: true
    };

    if (req.files?.profilePhoto?.[0]) {
      updateData.profilePhoto = '/uploads/' + req.files.profilePhoto[0].filename;
    }
    if (req.files?.clinicPhoto?.[0]) {
      updateData.clinicPhoto = '/uploads/' + req.files.clinicPhoto[0].filename;
    }

    const doctor = await Doctor.findByIdAndUpdate(req.doctorId, updateData, { new: true });
    // Mark profile complete on MobileAccount (locks role permanently)
    await MobileAccount.findOneAndUpdate({ mobile: doctor.mobile }, { profileCompleted: true, role: 'doctor' });
    res.json({ message: 'Profile updated successfully', doctor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function timeDiffHours(start, end) {
  const toMins = t => {
    const [time, ap] = t.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  return (toMins(end) - toMins(start)) / 60;
}

function safeParseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = router;
