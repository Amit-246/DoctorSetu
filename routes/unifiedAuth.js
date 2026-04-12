const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const MobileAccount = require('../models/MobileAccount');
const Doctor  = require('../models/Doctor');
const Nurse   = require('../models/Nurse');
const Patient = require('../models/Patient');

// ── SEND OTP ──────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^[0-9]{10}$/.test(mobile))
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60000);

    await MobileAccount.findOneAndUpdate({ mobile }, { otp, otpExpiry }, { upsert: true, new: true });
    console.log(`[OTP] ${mobile}: ${otp}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── VERIFY OTP ────────────────────────────────────────────
// Returns: { token, lockedRole } — lockedRole is set if this mobile already has a role+profile
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const account = await MobileAccount.findOne({ mobile });
    if (!account || account.otp !== otp || account.otpExpiry < new Date())
      return res.status(400).json({ error: 'Invalid or expired OTP' });

    account.otp = undefined;
    account.otpExpiry = undefined;
    account.isVerified = true;
    await account.save();

    const token = jwt.sign({ mobile }, process.env.JWT_SECRET, { expiresIn: '15m' });

    // Return lockedRole if role is already assigned (regardless of profileCompleted)
    // This ensures role selection is NEVER shown again once a role is picked
    const lockedRole = account.role || null;
    res.json({ message: 'OTP verified', token, lockedRole, profileCompleted: account.profileCompleted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SELECT ROLE ───────────────────────────────────────────
// Locks the role on first selection; blocks if a different role is already locked
router.post('/select-role', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const { mobile } = decoded;
    const { role } = req.body;

    if (!['patient', 'doctor', 'nurse'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const account = await MobileAccount.findOne({ mobile });

    // If role is already locked to a DIFFERENT role, block it
    if (account && account.role && account.role !== role) {
      return res.status(403).json({
        error: `This number is already registered as a ${account.role}. Please login as ${account.role}.`,
        lockedRole: account.role
      });
    }

    // Lock the role on this mobile (if not already set)
    if (account && !account.role) {
      account.role = role;
      await account.save();
    }

    if (role === 'doctor') {
      let doctor = await Doctor.findOne({ mobile });
      if (!doctor) doctor = await Doctor.create({ mobile });
      const token = jwt.sign({ id: doctor._id, mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, isProfileComplete: doctor.isProfileComplete });
    }

    if (role === 'nurse') {
      let nurse = await Nurse.findOne({ mobile });
      if (!nurse) nurse = await Nurse.create({ mobile });
      const token = jwt.sign({ id: nurse._id, mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, isProfileComplete: nurse.isProfileComplete });
    }

    if (role === 'patient') {
      const hasProfile = await Patient.exists({ mobile });
      return res.json({ token: authHeader.split(' ')[1], isProfileComplete: !!hasProfile });
    }
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    res.status(500).json({ error: e.message });
  }
});

// ── MARK PROFILE COMPLETE ─────────────────────────────────
// Called after profile creation to lock profileCompleted = true on MobileAccount
router.post('/profile-complete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const { mobile } = decoded;

    await MobileAccount.findOneAndUpdate({ mobile }, { profileCompleted: true });
    res.json({ message: 'Profile marked complete' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
