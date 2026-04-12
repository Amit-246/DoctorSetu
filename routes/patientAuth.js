const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const MobileAccount = require('../models/MobileAccount');
const Patient = require('../models/Patient');
const patientAuth = require('../middleware/patientAuth');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60000);

    await MobileAccount.findOneAndUpdate(
      { mobile },
      { otp, otpExpiry },
      { upsert: true, new: true }
    );

    console.log(`[PATIENT OTP] ${mobile}: ${otp}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP — returns a mobile-level token (no patientId yet)
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const account = await MobileAccount.findOne({ mobile });

    if (!account || account.otp !== otp || account.otpExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    account.isVerified = true;
    account.otp = undefined;
    account.otpExpiry = undefined;
    await account.save();

    // Token carries only mobile — patient profile selected on next screen
    const token = jwt.sign({ mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const hasProfile = await Patient.exists({ mobile });
    res.json({ message: 'OTP verified', token, hasProfile: !!hasProfile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all patient profiles for this mobile
router.get('/profiles', patientAuth, async (req, res) => {
  try {
    const patients = await Patient.find({ mobile: req.mobile });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new patient profile under this mobile
router.post('/profiles', patientAuth, async (req, res) => {
  try {
    const { name, age, gender, email } = req.body;

    if (!name || !age || !gender) {
      return res.status(400).json({ error: 'Name, age and gender are required' });
    }

    const patient = await Patient.create({
      mobile: req.mobile,
      name,
      age,
      gender,
      email: email || '',
      relation: 'Self'
    });
    // Lock role on MobileAccount
    await MobileAccount.findOneAndUpdate({ mobile: req.mobile }, { role: 'patient', profileCompleted: true });
    res.json({ message: 'Profile created', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an existing patient profile
router.put('/profiles/:id', patientAuth, async (req, res) => {
  try {
    const { name, age, gender, email, relation } = req.body;

    if (!name || !age || !gender) {
      return res.status(400).json({ error: 'Name, age and gender are required' });
    }

    const update = { name, age, gender, email: email || '' };
    if (relation) update.relation = relation;

    const patient = await Patient.findOneAndUpdate(
      { _id: req.params.id, mobile: req.mobile },
      update,
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile updated', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Select a profile — returns a token with patientId embedded
router.post('/select-profile', patientAuth, async (req, res) => {
  try {
    const { patientId } = req.body;

    const patient = await Patient.findOne({ _id: patientId, mobile: req.mobile });

    if (!patient) {
      return res.status(404).json({ error: 'Profile not found for this mobile' });
    }

    const token = jwt.sign(
      { mobile: req.mobile, patientId: patient._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Profile selected', token, patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
