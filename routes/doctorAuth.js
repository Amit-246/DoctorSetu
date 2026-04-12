const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60000);

    let doctor = await Doctor.findOne({ mobile });
    if (doctor) {
      doctor.otp = otp;
      doctor.otpExpiry = otpExpiry;
      await doctor.save();
    } else {
      doctor = await Doctor.create({ mobile, otp, otpExpiry });
    }

    console.log(`[DOCTOR OTP] ${mobile}: ${otp}`);
    res.json({ message: 'OTP sent successfully', mobile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const doctor = await Doctor.findOne({ mobile });
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (doctor.otp !== otp || doctor.otpExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    doctor.isVerified = true;
    doctor.otp = undefined;
    doctor.otpExpiry = undefined;
    await doctor.save();

    const token = jwt.sign({ id: doctor._id, mobile: doctor.mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful', token, isProfileComplete: doctor.isProfileComplete, doctor: { id: doctor._id, mobile: doctor.mobile, name: doctor.firstName } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
